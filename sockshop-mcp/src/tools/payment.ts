import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

import { sockShopAuth } from "../auth.js";
import { sockShopClient } from "../client.js";
import type { Card, ResourceLinks } from "../types.js";

type ToolArgs = Record<string, unknown> | undefined;
type ToolHandler = (args?: ToolArgs) => Promise<CallToolResult>;
type HalCollection<T> = {
  _embedded?: Record<string, T[] | undefined>;
};

interface CardResource extends Card {
  _links?: ResourceLinks;
}

interface CreateCardInput {
  longNum: string;
  expires: string;
  ccv: string;
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

function normalizeCard(card: CardResource): Card {
  const { _links: _ignored, ...rest } = card;
  return rest;
}

function getDeleteSuccess(response: DeleteResponse | undefined): boolean {
  return typeof response?.status === "boolean" ? response.status : true;
}

async function handleCardsList(): Promise<CallToolResult> {
  const response = await sockShopClient.get<
    HalCollection<CardResource> | CardResource[]
  >("/cards");
  const cards = getCollectionItems(response, "card");

  return textResult(cards.map(normalizeCard));
}

async function handleCardsCreate(args?: ToolArgs): Promise<CallToolResult> {
  const input = getObjectArgs(args);
  const longNum = getRequiredString(input, "longNum");
  const expires = getRequiredString(input, "expires");
  const ccv = getRequiredString(input, "ccv");

  await sockShopAuth.ensureLoggedIn();
  const response = await sockShopClient.post<CreateResponse, CreateCardInput>(
    "/cards",
    {
      longNum,
      expires,
      ccv,
    },
  );

  return textResult({
    id: response.id,
    longNum,
    expires,
    ccv,
  } satisfies Card);
}

async function handleCardsDelete(args?: ToolArgs): Promise<CallToolResult> {
  const input = getObjectArgs(args);
  const id = getRequiredString(input, "id");
  const response = await sockShopClient.del<DeleteResponse>(
    `/cards/${encodeURIComponent(id)}`,
  );

  return textResult({
    success: getDeleteSuccess(response),
    id,
  });
}

export const paymentTools = [
  {
    name: "sockshop_cards_list",
    description:
      "List all cards from the public Sock Shop gateway endpoint. This exposes full card data.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "sockshop_cards_create",
    description: "Create a card for the currently authenticated Sock Shop user.",
    inputSchema: {
      type: "object",
      properties: {
        longNum: {
          type: "string",
          description: "Full card number.",
        },
        expires: {
          type: "string",
          description: 'Expiry string, for example "08/25".',
        },
        ccv: {
          type: "string",
          description: "Card security code.",
        },
      },
      required: ["longNum", "expires", "ccv"],
    },
  },
  {
    name: "sockshop_cards_delete",
    description: "Delete a card by ID through the Sock Shop gateway.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Card ID.",
        },
      },
      required: ["id"],
    },
  },
] satisfies Tool[];

export const paymentToolHandlers = {
  sockshop_cards_list: handleCardsList,
  sockshop_cards_create: handleCardsCreate,
  sockshop_cards_delete: handleCardsDelete,
} satisfies Record<(typeof paymentTools)[number]["name"], ToolHandler>;
