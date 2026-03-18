import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

import { sockShopAuth } from "../auth.js";
import { sockShopClient } from "../client.js";
import type { Address, Customer, ResourceLinks } from "../types.js";

type ToolArgs = Record<string, unknown> | undefined;
type ToolHandler = (args?: ToolArgs) => Promise<CallToolResult>;
type HalCollection<T> = {
  _embedded?: Record<string, T[] | undefined>;
};
type CustomerSummary = Omit<Customer, "_links">;

interface AddressResource extends Address {
  _links?: ResourceLinks;
}

interface CreateAddressInput {
  street: string;
  number: string;
  country: string;
  city: string;
  postcode: string;
}

interface CreateResponse {
  id: string;
}

interface DeleteResponse {
  status?: boolean;
}

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

function getCollectionItems<T>(
  response: HalCollection<T> | T[],
  embeddedKey: string,
): T[] {
  if (Array.isArray(response)) {
    return response;
  }

  const values = response._embedded?.[embeddedKey];
  return Array.isArray(values) ? values : [];
}

function normalizeCustomer(customer: Customer): CustomerSummary {
  const { _links: _ignored, ...rest } = customer;
  return rest;
}

function normalizeAddress(address: AddressResource): Address {
  const { _links: _ignored, ...rest } = address;
  return rest;
}

function getDeleteSuccess(response: DeleteResponse | undefined): boolean {
  return typeof response?.status === "boolean" ? response.status : true;
}

async function handleCustomersList(): Promise<CallToolResult> {
  const response = await sockShopClient.get<HalCollection<Customer> | Customer[]>(
    "/customers",
  );
  const customers = getCollectionItems(response, "customer");

  return textResult(customers.map(normalizeCustomer));
}

async function handleCustomerMe(): Promise<CallToolResult> {
  const session = await sockShopAuth.ensureLoggedIn();

  if (!session.customerId) {
    throw new Error("Authenticated session is missing a customer ID.");
  }

  const customer = await sockShopClient.get<Customer>(
    `/customers/${encodeURIComponent(session.customerId)}`,
  );

  return textResult(customer);
}

async function handleAddressesList(): Promise<CallToolResult> {
  const response = await sockShopClient.get<
    HalCollection<AddressResource> | AddressResource[]
  >("/addresses");
  const addresses = getCollectionItems(response, "address");

  return textResult(addresses.map(normalizeAddress));
}

async function handleAddressesCreate(args?: ToolArgs): Promise<CallToolResult> {
  const input = getObjectArgs(args);
  const street = getRequiredString(input, "street");
  const number = getRequiredString(input, "number");
  const country = getRequiredString(input, "country");
  const city = getRequiredString(input, "city");
  const postcode = getRequiredString(input, "postcode");

  await sockShopAuth.ensureLoggedIn();
  const response = await sockShopClient.post<CreateResponse, CreateAddressInput>(
    "/addresses",
    {
      street,
      number,
      country,
      city,
      postcode,
    },
  );

  return textResult({
    id: response.id,
    street,
    number,
    country,
    city,
    postcode,
  } satisfies Address);
}

async function handleAddressesDelete(args?: ToolArgs): Promise<CallToolResult> {
  const input = getObjectArgs(args);
  const id = getRequiredString(input, "id");
  const response = await sockShopClient.del<DeleteResponse>(
    `/addresses/${encodeURIComponent(id)}`,
  );

  return textResult({
    success: getDeleteSuccess(response),
    id,
  });
}

export const userTools = [
  {
    name: "sockshop_customers_list",
    description:
      "List all Sock Shop customers from the public gateway endpoint and strip HAL link metadata from the result.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "sockshop_customer_me",
    description:
      "Get the current authenticated customer's profile. The gateway ignores any path id and always resolves the active session user.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "sockshop_addresses_list",
    description: "List all addresses from the public Sock Shop gateway endpoint.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "sockshop_addresses_create",
    description: "Create an address for the currently authenticated Sock Shop user.",
    inputSchema: {
      type: "object",
      properties: {
        street: {
          type: "string",
          description: "Street name.",
        },
        number: {
          type: "string",
          description: "Street number or unit.",
        },
        country: {
          type: "string",
          description: "Country name.",
        },
        city: {
          type: "string",
          description: "City name.",
        },
        postcode: {
          type: "string",
          description: "Postal code.",
        },
      },
      required: ["street", "number", "country", "city", "postcode"],
    },
  },
  {
    name: "sockshop_addresses_delete",
    description: "Delete an address by ID through the Sock Shop gateway.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Address ID.",
        },
      },
      required: ["id"],
    },
  },
] satisfies Tool[];

export const userToolHandlers = {
  sockshop_customers_list: handleCustomersList,
  sockshop_customer_me: handleCustomerMe,
  sockshop_addresses_list: handleAddressesList,
  sockshop_addresses_create: handleAddressesCreate,
  sockshop_addresses_delete: handleAddressesDelete,
} satisfies Record<(typeof userTools)[number]["name"], ToolHandler>;
