import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

import { sockShopAuth } from "../auth.js";
import { sockShopClient } from "../client.js";
import type { CartItem } from "../types.js";

type ToolArgs = Record<string, unknown> | undefined;
type ToolHandler = (args?: ToolArgs) => Promise<CallToolResult>;
type CartItemResult = Pick<CartItem, "itemId" | "quantity" | "unitPrice">;

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

function getRequiredNumber(args: Record<string, unknown>, name: string): number {
  const value = args[name];

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Missing required numeric argument "${name}".`);
  }

  return value;
}

function normalizeCartItem(item: CartItem): CartItemResult {
  return {
    itemId: item.itemId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  };
}

async function listCartItems(): Promise<CartItemResult[]> {
  await sockShopAuth.ensureLoggedIn();
  const items = await sockShopClient.get<CartItem[]>("/cart");
  return items.map(normalizeCartItem);
}

async function handleCartGet(): Promise<CallToolResult> {
  return textResult(await listCartItems());
}

async function handleCartAddItem(args?: ToolArgs): Promise<CallToolResult> {
  const input = getObjectArgs(args);
  const id = getRequiredString(input, "id");

  await sockShopAuth.ensureLoggedIn();
  await sockShopClient.post<unknown, { id: string }>("/cart", { id });

  return textResult({
    success: true,
    itemId: id,
    quantityAdded: 1,
  });
}

async function handleCartUpdateItem(args?: ToolArgs): Promise<CallToolResult> {
  const input = getObjectArgs(args);
  const id = getRequiredString(input, "id");
  const quantity = getRequiredNumber(input, "quantity");

  await sockShopAuth.ensureLoggedIn();
  await sockShopClient.post<unknown, { id: string; quantity: number }>(
    "/cart/update",
    { id, quantity },
  );

  return textResult({
    success: true,
    itemId: id,
    quantity,
  });
}

async function handleCartClear(): Promise<CallToolResult> {
  await sockShopAuth.ensureLoggedIn();
  await sockShopClient.del<unknown>("/cart");

  return textResult({ success: true });
}

async function handleCartRemoveItem(args?: ToolArgs): Promise<CallToolResult> {
  const input = getObjectArgs(args);
  const itemId = getRequiredString(input, "itemId");

  await sockShopAuth.ensureLoggedIn();
  await sockShopClient.del<unknown>(`/cart/${encodeURIComponent(itemId)}`);

  return textResult({
    success: true,
    itemId,
  });
}

export const cartTools = [
  {
    name: "sockshop_cart_get",
    description:
      "List items in the current cart for the active Sock Shop session. Auto-logs in from env vars when needed.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "sockshop_cart_add_item",
    description:
      "Add a catalogue product to the current cart. The gateway always adds quantity 1 per call, even if a quantity argument is sent.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Product ID from the Sock Shop catalogue.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "sockshop_cart_update_item",
    description: "Update the quantity of a catalogue product in the current cart.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Product ID from the Sock Shop catalogue.",
        },
        quantity: {
          type: "number",
          description: "Desired quantity for that product in the cart.",
        },
      },
      required: ["id", "quantity"],
    },
  },
  {
    name: "sockshop_cart_clear",
    description: "Delete all items from the current cart.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "sockshop_cart_remove_item",
    description: "Remove a single catalogue item from the current cart by itemId.",
    inputSchema: {
      type: "object",
      properties: {
        itemId: {
          type: "string",
          description: "Catalogue product UUID to remove from the cart.",
        },
      },
      required: ["itemId"],
    },
  },
] satisfies Tool[];

export const cartToolHandlers = {
  sockshop_cart_get: handleCartGet,
  sockshop_cart_add_item: handleCartAddItem,
  sockshop_cart_update_item: handleCartUpdateItem,
  sockshop_cart_clear: handleCartClear,
  sockshop_cart_remove_item: handleCartRemoveItem,
} satisfies Record<(typeof cartTools)[number]["name"], ToolHandler>;
