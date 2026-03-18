import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";

import { sockShopAuth } from "../auth.js";

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

function getRequiredString(args: Record<string, unknown>, name: string): string {
  const value = args[name];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Missing required string argument "${name}".`);
  }

  return value;
}

async function handleLogin(args?: ToolArgs): Promise<CallToolResult> {
  const input = getObjectArgs(args);
  const username = getRequiredString(input, "username");
  const password = getRequiredString(input, "password");
  const session = await sockShopAuth.login(username, password);

  return textResult({
    success: true,
    customerId: session.customerId,
    username: session.username,
  });
}

async function handleRegister(args?: ToolArgs): Promise<CallToolResult> {
  const input = getObjectArgs(args);
  const username = getRequiredString(input, "username");
  const password = getRequiredString(input, "password");
  const email = getRequiredString(input, "email");
  const firstName = getRequiredString(input, "firstName");
  const lastName = getRequiredString(input, "lastName");
  const session = await sockShopAuth.register(
    username,
    password,
    email,
    firstName,
    lastName,
  );

  return textResult({
    success: true,
    customerId: session.customerId,
  });
}

async function handleWhoAmI(): Promise<CallToolResult> {
  await sockShopAuth.ensureLoggedIn();
  return textResult(sockShopAuth.getSessionState());
}

export const authTools = [
  {
    name: "sockshop_login",
    description:
      "Log in through the Sock Shop gateway using the session-cookie auth flow.",
    inputSchema: {
      type: "object",
      properties: {
        username: {
          type: "string",
          description: "Sock Shop username.",
        },
        password: {
          type: "string",
          description: "Sock Shop password.",
        },
      },
      required: ["username", "password"],
    },
  },
  {
    name: "sockshop_register",
    description:
      "Register a new Sock Shop user through the gateway and establish a session.",
    inputSchema: {
      type: "object",
      properties: {
        username: {
          type: "string",
          description: "Sock Shop username.",
        },
        password: {
          type: "string",
          description: "Sock Shop password.",
        },
        email: {
          type: "string",
          description: "Customer email address.",
        },
        firstName: {
          type: "string",
          description: "Customer first name.",
        },
        lastName: {
          type: "string",
          description: "Customer last name.",
        },
      },
      required: ["username", "password", "email", "firstName", "lastName"],
    },
  },
  {
    name: "sockshop_whoami",
    description:
      "Return the current gateway session state, auto-logging in from env vars when needed.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
] satisfies Tool[];

export const authToolHandlers = {
  sockshop_login: handleLogin,
  sockshop_register: handleRegister,
  sockshop_whoami: handleWhoAmI,
} satisfies Record<(typeof authTools)[number]["name"], ToolHandler>;
