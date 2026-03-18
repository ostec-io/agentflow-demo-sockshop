import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
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

const app = express();
const PORT = parseInt(process.env.PORT ?? "3000", 10);

const transports = new Map<string, SSEServerTransport>();

app.get("/sse", async (_req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports.set(transport.sessionId, transport);

  const server = new Server(
    { name: "sockshop", version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const handler =
      toolHandlers[request.params.name as keyof typeof toolHandlers];

    if (!handler) {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    return handler(request.params.arguments);
  });

  res.on("close", () => {
    transports.delete(transport.sessionId);
  });

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  await transport.handlePostMessage(req, res);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", tools: tools.length });
});

app.listen(PORT, () => {
  console.log(`Sock Shop MCP server (SSE) listening on port ${PORT}`);
  console.log(`  SSE endpoint:    http://localhost:${PORT}/sse`);
  console.log(`  Health check:    http://localhost:${PORT}/health`);
  console.log(`  Sock Shop base:  ${process.env.SOCKSHOP_BASE_URL ?? "http://localhost:8888"}`);
});
