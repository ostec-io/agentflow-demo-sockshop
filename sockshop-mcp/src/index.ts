import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { authToolHandlers, authTools } from "./tools/auth.js";
import { cartToolHandlers, cartTools } from "./tools/cart.js";
import { catalogueToolHandlers, catalogueTools } from "./tools/catalogue.js";
import { orderToolHandlers, orderTools } from "./tools/orders.js";
import { paymentToolHandlers, paymentTools } from "./tools/payment.js";
import { userToolHandlers, userTools } from "./tools/users.js";

const toolHandlers = {
  ...catalogueToolHandlers,
  ...authToolHandlers,
  ...cartToolHandlers,
  ...orderToolHandlers,
  ...userToolHandlers,
  ...paymentToolHandlers,
};

const tools = [
  ...catalogueTools,
  ...authTools,
  ...cartTools,
  ...orderTools,
  ...userTools,
  ...paymentTools,
];

const server = new Server(
  { name: "sockshop", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const handler = toolHandlers[request.params.name as keyof typeof toolHandlers];

  if (!handler) {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  return handler(request.params.arguments);
});

const transport = new StdioServerTransport();
await server.connect(transport);
