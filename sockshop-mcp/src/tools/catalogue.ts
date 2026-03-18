import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

import { sockShopClient } from "../client.js";
import type {
  CatalogueSizeResponse,
  Product,
  RawProduct,
  TagsResponse,
} from "../types.js";

type ToolArgs = Record<string, unknown> | undefined;
type ToolHandler = (args?: ToolArgs) => Promise<CallToolResult>;

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

function getOptionalNumber(
  args: Record<string, unknown>,
  name: string,
): number | undefined {
  const value = args[name];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`Expected "${name}" to be a number.`);
  }

  return value;
}

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      searchParams.set(key, String(value));
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function normalizeProduct(product: RawProduct): Product {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: product.price,
    count: product.count,
    tags: product.tag,
  };
}

async function handleCatalogueList(args?: ToolArgs): Promise<CallToolResult> {
  const input = getObjectArgs(args);
  const tags = getOptionalString(input, "tags");
  const page = getOptionalNumber(input, "page");
  const size = getOptionalNumber(input, "size");
  const query = buildQueryString({ tags, page, size });
  const products = await sockShopClient.get<RawProduct[]>(`/catalogue${query}`);

  return textResult(products.map(normalizeProduct));
}

async function handleCatalogueGet(args?: ToolArgs): Promise<CallToolResult> {
  const input = getObjectArgs(args);
  const id = getRequiredString(input, "id");
  const product = await sockShopClient.get<RawProduct>(
    `/catalogue/${encodeURIComponent(id)}`,
  );

  return textResult(normalizeProduct(product));
}

async function handleCatalogueSize(args?: ToolArgs): Promise<CallToolResult> {
  const input = getObjectArgs(args);
  const tags = getOptionalString(input, "tags");
  const query = buildQueryString({ tags });
  const response = await sockShopClient.get<CatalogueSizeResponse>(
    `/catalogue/size${query}`,
  );

  return textResult({ size: response.size });
}

async function handleTagsList(): Promise<CallToolResult> {
  const response = await sockShopClient.get<TagsResponse>("/tags");
  return textResult({ tags: response.tags });
}

export const catalogueTools = [
  {
    name: "sockshop_catalogue_list",
    description:
      "List products from the Sock Shop catalogue. Optionally filter by tags, paginate with page and size.",
    inputSchema: {
      type: "object",
      properties: {
        tags: {
          type: "string",
          description:
            "Comma-separated tag filter, for example 'formal' or 'sport,blue'.",
        },
        page: {
          type: "number",
          description: "Page number, starting from 1.",
        },
        size: {
          type: "number",
          description: "Number of products per page.",
        },
      },
    },
  },
  {
    name: "sockshop_catalogue_get",
    description: "Get a single product from the Sock Shop catalogue by UUID.",
    inputSchema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "Product UUID.",
        },
      },
      required: ["id"],
    },
  },
  {
    name: "sockshop_catalogue_size",
    description:
      "Get the number of products in the Sock Shop catalogue, optionally filtered by tags.",
    inputSchema: {
      type: "object",
      properties: {
        tags: {
          type: "string",
          description:
            "Comma-separated tag filter, for example 'formal' or 'sport,blue'.",
        },
      },
    },
  },
  {
    name: "sockshop_tags_list",
    description: "List the available Sock Shop product tags.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
] satisfies Tool[];

export const catalogueToolHandlers = {
  sockshop_catalogue_list: handleCatalogueList,
  sockshop_catalogue_get: handleCatalogueGet,
  sockshop_catalogue_size: handleCatalogueSize,
  sockshop_tags_list: handleTagsList,
} satisfies Record<(typeof catalogueTools)[number]["name"], ToolHandler>;
