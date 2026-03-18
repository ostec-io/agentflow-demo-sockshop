import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

import { sockShopAuth } from "../auth.js";
import { sockShopClient } from "../client.js";
import type {
  Address,
  Card,
  CartItem,
  ResourceLinks,
  Shipment,
} from "../types.js";

type ToolArgs = Record<string, unknown> | undefined;
type ToolHandler = (args?: ToolArgs) => Promise<CallToolResult>;
type HalCollection<T> = {
  _embedded?: Record<string, T[] | undefined>;
};
type NormalizedOrder = {
  id?: string;
  customerId: string;
  address: Address;
  card: Card;
  items: CartItem[];
  shipment: Shipment;
  date: string;
  total: number;
};

interface CustomerProfile {
  id: string;
  _links: ResourceLinks;
}

interface AddressResource extends Address {
  _links?: ResourceLinks;
}

interface CardResource extends Card {
  _links?: ResourceLinks;
}

interface RawOrder {
  id?: string;
  customerId: string;
  address: Address;
  card: Card;
  items: CartItem[];
  shipment: Shipment;
  date: string;
  total: number;
  _links?: ResourceLinks;
}

interface CheckoutErrorBody {
  status?: number;
  message?: string;
}

const execFileAsync = promisify(execFile);
const INTERNAL_SERVICE_HOSTS = new Set(["user", "orders", "carts", "catalogue"]);
const SHIPPING_COST = 4.99;
const PAYMENT_THRESHOLD = 100;
let dockerProxyContainerPromise: Promise<string> | undefined;

function textResult(result: unknown): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

function getObjectArgs(args: ToolArgs): Record<string, unknown> {
  if (args === undefined) {
    return {};
  }

  return args;
}

function getOptionalString(
  args: Record<string, unknown>,
  name: string,
): string | undefined {
  const value = args[name];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`Expected "${name}" to be a string.`);
  }

  return value;
}

function getRequiredString(args: Record<string, unknown>, name: string): string {
  const value = getOptionalString(args, name);

  if (!value) {
    throw new Error(`Missing required string argument "${name}".`);
  }

  return value;
}

function roundMoney(amount: number): number {
  return Number(amount.toFixed(2));
}

function getOrderId(order: RawOrder): string | undefined {
  if (order.id) {
    return order.id;
  }

  return parseTrailingId(order._links?.self?.href);
}

function parseTrailingId(href: string | undefined): string | undefined {
  if (!href) {
    return undefined;
  }

  const trimmed = href.replace(/\/+$/, "");
  const segments = trimmed.split("/");
  return segments.at(-1);
}

function normalizeOrder(order: RawOrder): NormalizedOrder {
  return {
    id: getOrderId(order),
    customerId: order.customerId,
    address: order.address,
    card: order.card,
    items: order.items,
    shipment: order.shipment,
    date: order.date,
    total: roundMoney(order.total),
  };
}

function getResourceId(
  resource: { id?: string; _links?: ResourceLinks },
): string | undefined {
  return resource.id ?? parseTrailingId(resource._links?.self?.href);
}

function selectAddress(
  addresses: AddressResource[],
  addressId: string | undefined,
): AddressResource {
  if (addresses.length === 0) {
    throw new Error(
      "No address on file. Create one with sockshop_addresses_create first.",
    );
  }

  if (!addressId) {
    return addresses[0];
  }

  const match = addresses.find((address) => getResourceId(address) === addressId);
  if (!match) {
    throw new Error(`Address "${addressId}" not found for the current user.`);
  }

  return match;
}

function selectCard(cards: CardResource[], cardId: string | undefined): CardResource {
  if (cards.length === 0) {
    throw new Error("No card on file. Create one with sockshop_cards_create first.");
  }

  if (!cardId) {
    return cards[0];
  }

  const match = cards.find((card) => getResourceId(card) === cardId);
  if (!match) {
    throw new Error(`Card "${cardId}" not found for the current user.`);
  }

  return match;
}

function calculateOrderTotal(items: CartItem[]): number {
  const itemsTotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  return roundMoney(itemsTotal + SHIPPING_COST);
}

function parseCheckoutFailure(error: unknown): {
  status?: number;
  body?: CheckoutErrorBody;
} {
  if (!(error instanceof Error)) {
    return {};
  }

  const match = error.message.match(/ failed with (\d+)(?:: ([\s\S]+))?$/);
  if (!match) {
    return {};
  }

  const status = Number(match[1]);
  const rawBody = match[2];
  if (!rawBody) {
    return { status };
  }

  try {
    return {
      status,
      body: JSON.parse(rawBody) as CheckoutErrorBody,
    };
  } catch {
    return { status };
  }
}

function lastFour(cardNumber: string | undefined): string {
  return cardNumber ? cardNumber.slice(-4) : "";
}

function isInternalServiceUrl(url: URL): boolean {
  return INTERNAL_SERVICE_HOSTS.has(url.hostname);
}

async function resolveDockerProxyContainer(): Promise<string> {
  const services = ["front-end", "edge-router"];

  for (const service of services) {
    const { stdout } = await execFileAsync(
      "docker",
      [
        "ps",
        "--filter",
        `label=com.docker.compose.service=${service}`,
        "--format",
        "{{.Names}}",
      ],
      { encoding: "utf8", maxBuffer: 1024 * 1024 },
    );
    const container = stdout
      .split(/\r?\n/)
      .map((value) => value.trim())
      .find(Boolean);

    if (container) {
      return container;
    }
  }

  throw new Error(
    "Could not locate a running Sock Shop Docker container to resolve internal service links.",
  );
}

async function getDockerProxyContainer(): Promise<string> {
  if (!dockerProxyContainerPromise) {
    dockerProxyContainerPromise = resolveDockerProxyContainer();
  }

  return dockerProxyContainerPromise;
}

async function fetchJsonViaDocker<T>(href: string): Promise<T> {
  const container = await getDockerProxyContainer();

  try {
    const { stdout } = await execFileAsync(
      "docker",
      ["exec", container, "wget", "-qO-", href],
      { encoding: "utf8", maxBuffer: 1024 * 1024 * 5 },
    );
    return JSON.parse(stdout) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to resolve internal link "${href}". ${message}`);
  }
}

async function getJson<T>(pathOrUrl: string): Promise<T> {
  let parsedUrl: URL | undefined;

  try {
    parsedUrl = new URL(pathOrUrl);
  } catch {
    parsedUrl = undefined;
  }

  if (!parsedUrl || !isInternalServiceUrl(parsedUrl)) {
    return sockShopClient.get<T>(pathOrUrl);
  }

  try {
    return await sockShopClient.get<T>(pathOrUrl);
  } catch {
    return fetchJsonViaDocker<T>(parsedUrl.toString());
  }
}

async function getEmbeddedItems<T>(
  href: string,
  embeddedKey: string,
): Promise<T[]> {
  const response = await getJson<HalCollection<T>>(href);
  const values = response._embedded?.[embeddedKey];
  return Array.isArray(values) ? values : [];
}

async function listOrders(): Promise<NormalizedOrder[]> {
  await sockShopAuth.ensureLoggedIn();
  const response = await sockShopClient.get<RawOrder[] | HalCollection<RawOrder>>(
    "/orders",
  );
  const orders = Array.isArray(response)
    ? response
    : response._embedded?.customerOrders ?? [];

  return orders.map(normalizeOrder);
}

async function handleOrdersList(): Promise<CallToolResult> {
  return textResult(await listOrders());
}

async function handleOrdersGet(args?: ToolArgs): Promise<CallToolResult> {
  const input = getObjectArgs(args);
  const id = getRequiredString(input, "id");

  await sockShopAuth.ensureLoggedIn();
  const order = await sockShopClient.get<RawOrder>(
    `/orders/${encodeURIComponent(id)}`,
  );

  return textResult(normalizeOrder(order));
}

async function handleCheckout(args?: ToolArgs): Promise<CallToolResult> {
  const input = getObjectArgs(args);
  const addressId = getOptionalString(input, "addressId");
  const cardId = getOptionalString(input, "cardId");
  const session = await sockShopAuth.ensureLoggedIn();

  if (!session.customerId) {
    throw new Error("Authenticated session is missing a customer ID.");
  }

  const customer = await sockShopClient.get<CustomerProfile>(
    `/customers/${encodeURIComponent(session.customerId)}`,
  );
  const addressesHref = customer._links.addresses?.href;
  const cardsHref = customer._links.cards?.href;

  if (!addressesHref) {
    throw new Error("Customer profile did not include an addresses link.");
  }

  if (!cardsHref) {
    throw new Error("Customer profile did not include a cards link.");
  }

  const addresses = await getEmbeddedItems<AddressResource>(addressesHref, "address");
  const selectedAddress = selectAddress(addresses, addressId);
  const cards = await getEmbeddedItems<CardResource>(cardsHref, "card");
  const selectedCard = selectCard(cards, cardId);
  const cartItems = await sockShopClient.get<CartItem[]>("/cart");
  const expectedTotal = calculateOrderTotal(cartItems);

  void selectedAddress;
  void selectedCard;

  try {
    const order = await sockShopClient.post<RawOrder>("/orders");
    return textResult({
      success: true,
      orderId: getOrderId(order) ?? null,
      total: roundMoney(order.total),
      items: order.items,
      address: order.address,
      card: {
        lastFour: lastFour(order.card.longNum),
      },
      shipment: order.shipment,
    });
  } catch (error) {
    const failure = parseCheckoutFailure(error);

    if (failure.status === 406) {
      const message =
        expectedTotal > PAYMENT_THRESHOLD
          ? `Payment declined — order total $${expectedTotal.toFixed(2)} exceeds $100 threshold`
          : failure.body?.message ?? "Payment declined.";

      return textResult({
        success: false,
        error: message,
        total: expectedTotal,
      });
    }

    throw error;
  }
}

export const orderTools = [
  {
    name: "sockshop_orders_list",
    description: "List orders for the current logged-in Sock Shop user.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "sockshop_orders_get",
    description: "Get a single order by ID for the active Sock Shop session.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Order ID.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "sockshop_checkout",
    description:
      "Place an order for the current cart after validating that the active user has an address and card on file.",
    inputSchema: {
      type: "object",
      properties: {
        addressId: {
          type: "string",
          description:
            "Optional address ID to validate before checkout. The gateway still uses the session's default address.",
        },
        cardId: {
          type: "string",
          description:
            "Optional card ID to validate before checkout. The gateway still uses the session's default card.",
        },
      },
    },
  },
] satisfies Tool[];

export const orderToolHandlers = {
  sockshop_orders_list: handleOrdersList,
  sockshop_orders_get: handleOrdersGet,
  sockshop_checkout: handleCheckout,
} satisfies Record<(typeof orderTools)[number]["name"], ToolHandler>;
