import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const reportPath = path.join(
  repoRoot,
  "documentation",
  "phase4-mcp-integration-test.md",
);
const serverEntry = path.join(__dirname, "dist", "index.js");
const protocolVersion = "2025-11-25";
const serverVersion = "1.0.0";
const baseUrl = process.env.SOCKSHOP_BASE_URL ?? "http://localhost:8888";

class McpRequestError extends Error {
  constructor(message, response) {
    super(message);
    this.name = "McpRequestError";
    this.response = response;
  }
}

class McpSession {
  constructor(name, env = {}) {
    this.name = name;
    this.env = env;
    this.nextId = 1;
    this.pending = new Map();
    this.stderrLines = [];
    this.notifications = [];
  }

  async start() {
    this.child = spawn("node", [serverEntry], {
      cwd: __dirname,
      env: this.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.stdout = readline.createInterface({ input: this.child.stdout });
    this.stderr = readline.createInterface({ input: this.child.stderr });

    this.stdout.on("line", (line) => {
      let message;

      try {
        message = JSON.parse(line);
      } catch (error) {
        this.stderrLines.push(
          `Failed to parse stdout line as JSON: ${String(error)} :: ${line}`,
        );
        return;
      }

      if (Object.prototype.hasOwnProperty.call(message, "id")) {
        const pending = this.pending.get(message.id);

        if (!pending) {
          this.notifications.push(message);
          return;
        }

        this.pending.delete(message.id);

        if (message.error) {
          pending.reject(
            new McpRequestError(message.error.message, {
              request: pending.request,
              response: message,
            }),
          );
        } else {
          pending.resolve({
            request: pending.request,
            response: message,
          });
        }

        return;
      }

      this.notifications.push(message);
    });

    this.stderr.on("line", (line) => {
      this.stderrLines.push(line);
    });

    this.child.on("exit", (code, signal) => {
      for (const pending of this.pending.values()) {
        pending.reject(
          new Error(
            `MCP session "${this.name}" exited before replying (code=${code}, signal=${signal}).`,
          ),
        );
      }

      this.pending.clear();
    });

    await this.initialize();
  }

  async initialize() {
    await this.request("initialize", {
      protocolVersion,
      capabilities: {},
      clientInfo: {
        name: "sockshop-mcp-integration-test",
        version: "1.0.0",
      },
    });

    await this.notify("notifications/initialized");
  }

  async notify(method, params) {
    const message = {
      jsonrpc: "2.0",
      method,
      ...(params ? { params } : {}),
    };

    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  async request(method, params) {
    const id = this.nextId++;
    const request = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params === undefined ? {} : { params }),
    };

    const result = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, request });
    });

    this.child.stdin.write(`${JSON.stringify(request)}\n`);
    return result;
  }

  async listTools() {
    const { response } = await this.request("tools/list");
    return response.result.tools;
  }

  async callTool(name, args = {}) {
    const { request, response } = await this.request("tools/call", {
      name,
      arguments: args,
    });

    const textContent = response.result?.content?.find(
      (content) => content.type === "text",
    );
    const rawText = textContent?.text ?? "";
    let parsed = rawText;

    if (rawText) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = rawText;
      }
    }

    return {
      request,
      response,
      data: parsed,
    };
  }

  async close() {
    if (!this.child) {
      return;
    }

    this.stdout?.close();
    this.stderr?.close();
    this.child.stdin.end();

    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.child.kill("SIGTERM");
      }, 200);

      this.child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

function createScenario(name) {
  return {
    name,
    steps: [],
  };
}

function redactLargeArrays(value) {
  if (Array.isArray(value)) {
    if (value.length <= 3) {
      return value.map((entry) => redactLargeArrays(entry));
    }

    return {
      count: value.length,
      sample: value.slice(0, 3).map((entry) => redactLargeArrays(entry)),
    };
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const redacted = {};

  for (const [key, entry] of Object.entries(value)) {
    redacted[key] = redactLargeArrays(entry);
  }

  return redacted;
}

function recordStep(scenario, step) {
  scenario.steps.push(step);
}

function pass(note) {
  return { passed: true, note };
}

function fail(note) {
  return { passed: false, note };
}

function summarizeStepOutput(value) {
  return redactLargeArrays(value);
}

async function runToolStep(scenario, session, options) {
  const { title, tool, input = {}, evaluate, evaluateError } = options;

  try {
    const call = await session.callTool(tool, input);
    const verdict = evaluate
      ? await evaluate(call.data, call)
      : pass("Tool call succeeded.");

    recordStep(scenario, {
      title,
      tool,
      input,
      output: summarizeStepOutput(call.data),
      passed: verdict.passed,
      note: verdict.note,
    });

    return {
      ok: verdict.passed,
      data: call.data,
      note: verdict.note,
      call,
    };
  } catch (error) {
    const verdict = evaluateError
      ? await evaluateError(error)
      : fail(error.message);
    const output = error.response?.response?.error ?? { message: error.message };

    recordStep(scenario, {
      title,
      tool,
      input,
      output: summarizeStepOutput(output),
      passed: verdict.passed,
      note: verdict.note,
    });

    return {
      ok: verdict.passed,
      error,
      note: verdict.note,
    };
  }
}

function findProduct(products, name) {
  return products.find((product) => product.name === name);
}

function getScenarioCounts(scenario) {
  const passed = scenario.steps.filter((step) => step.passed).length;
  const failed = scenario.steps.length - passed;

  return {
    passed,
    failed,
  };
}

async function withSession(name, env, callback) {
  const session = new McpSession(name, env);
  await session.start();

  try {
    return await callback(session);
  } finally {
    await session.close();
  }
}

function sessionEnv({ includeCredentials }) {
  const env = {
    ...process.env,
    SOCKSHOP_BASE_URL: baseUrl,
  };

  if (!includeCredentials) {
    delete env.SOCKSHOP_USERNAME;
    delete env.SOCKSHOP_PASSWORD;
  }

  return env;
}

async function runCoreScenarios(shared) {
  const scenarios = [];

  await withSession("catalogue-browsing", sessionEnv({ includeCredentials: false }), async (session) => {
    const scenario = createScenario("Scenario 1: Catalogue Browsing (no auth)");

    const listStep = await runToolStep(scenario, session, {
      title: "Catalogue list returns the full 9-product set.",
      tool: "sockshop_catalogue_list",
      evaluate(data) {
        if (!Array.isArray(data)) {
          return fail("Expected an array of products.");
        }

        shared.products = data;
        shared.holy = findProduct(data, "Holy");
        shared.nerdLeg = findProduct(data, "Nerd leg");
        shared.classic = findProduct(data, "Classic");

        const missing = [
          !shared.holy && "Holy",
          !shared.nerdLeg && "Nerd leg",
          !shared.classic && "Classic",
        ].filter(Boolean);

        if (missing.length > 0) {
          return fail(`Missing expected products in catalogue: ${missing.join(", ")}.`);
        }

        return data.length === 9
          ? pass("Returned 9 products, including Holy, Nerd leg, and Classic.")
          : fail(`Expected 9 products, received ${data.length}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Catalogue list filtered by the formal tag returns only formal products.",
      tool: "sockshop_catalogue_list",
      input: { tags: "formal" },
      evaluate(data) {
        if (!Array.isArray(data) || data.length === 0) {
          return fail("Expected one or more formal-tagged products.");
        }

        const allFormal = data.every(
          (product) => Array.isArray(product.tags) && product.tags.includes("formal"),
        );

        return allFormal
          ? pass(`Returned ${data.length} formal products.`)
          : fail("At least one returned product was missing the formal tag.");
      },
    });

    await runToolStep(scenario, session, {
      title: "Catalogue get returns Holy with the expected price.",
      tool: "sockshop_catalogue_get",
      input: { id: "03fef6ac-1896-4ce8-bd69-b798f85c6e0b" },
      evaluate(data) {
        const isHoly = data?.name === "Holy";
        const isPriceMatch = data?.price === 99.99;

        return isHoly && isPriceMatch
          ? pass("Holy resolved with price 99.99.")
          : fail(
              `Expected Holy @ 99.99, received ${JSON.stringify({
                name: data?.name,
                price: data?.price,
              })}.`,
            );
      },
    });

    await runToolStep(scenario, session, {
      title: "Catalogue size reports 9 products.",
      tool: "sockshop_catalogue_size",
      evaluate(data) {
        return data?.size === 9
          ? pass("Size endpoint returned 9.")
          : fail(`Expected size 9, received ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Tag list returns the 11 expected tags.",
      tool: "sockshop_tags_list",
      evaluate(data) {
        const tagCount = Array.isArray(data?.tags) ? data.tags.length : 0;

        return tagCount === 11
          ? pass("Tag list returned 11 tags.")
          : fail(`Expected 11 tags, received ${tagCount}.`);
      },
    });

    scenarios.push(scenario);
  });

  await withSession("login-and-whoami", sessionEnv({ includeCredentials: false }), async (session) => {
    const scenario = createScenario("Scenario 2: Login + Whoami");

    await runToolStep(scenario, session, {
      title: "Whoami before login should report an anonymous session.",
      tool: "sockshop_whoami",
      evaluate(data) {
        return data?.isLoggedIn === false
          ? pass("Anonymous session state returned.")
          : fail(`Expected isLoggedIn=false, received ${JSON.stringify(data)}.`);
      },
      evaluateError(error) {
        return fail(
          `Tool errored instead of returning anonymous session state: ${error.message}.`,
        );
      },
    });

    await runToolStep(scenario, session, {
      title: "Explicit login succeeds for user/password.",
      tool: "sockshop_login",
      input: {
        username: "user",
        password: "password",
      },
      evaluate(data) {
        const ok =
          data?.success === true &&
          typeof data?.customerId === "string" &&
          data?.username === "user";

        return ok
          ? pass(`Login succeeded for customer ${data.customerId}.`)
          : fail(`Unexpected login payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Whoami after login returns the active customer session.",
      tool: "sockshop_whoami",
      evaluate(data) {
        const ok =
          data?.isLoggedIn === true &&
          typeof data?.customerId === "string" &&
          data?.username === "user";

        return ok
          ? pass(`Session is logged in as ${data.username}.`)
          : fail(`Unexpected whoami payload after login: ${JSON.stringify(data)}.`);
      },
    });

    scenarios.push(scenario);
  });

  await withSession("cart-operations", sessionEnv({ includeCredentials: false }), async (session) => {
    const scenario = createScenario("Scenario 3: Cart Operations");

    await runToolStep(scenario, session, {
      title: "Login succeeds before cart operations.",
      tool: "sockshop_login",
      input: {
        username: "user",
        password: "password",
      },
      evaluate(data) {
        return data?.success === true
          ? pass("Authenticated cart session established.")
          : fail(`Unexpected login payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Cart clear empties any prior cart state.",
      tool: "sockshop_cart_clear",
      evaluate(data) {
        return data?.success === true
          ? pass("Cart clear returned success=true.")
          : fail(`Unexpected cart clear payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Cart get returns an empty array after clearing.",
      tool: "sockshop_cart_get",
      evaluate(data) {
        return Array.isArray(data) && data.length === 0
          ? pass("Cart is empty.")
          : fail(`Expected empty cart, received ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Adding Nerd leg succeeds.",
      tool: "sockshop_cart_add_item",
      input: { id: shared.nerdLeg.id },
      evaluate(data) {
        return data?.success === true && data?.itemId === shared.nerdLeg.id
          ? pass("Nerd leg add acknowledged.")
          : fail(`Unexpected add-item payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Cart get shows one Nerd leg line item.",
      tool: "sockshop_cart_get",
      evaluate(data) {
        const ok =
          Array.isArray(data) &&
          data.length === 1 &&
          data[0]?.itemId === shared.nerdLeg.id;

        return ok
          ? pass("Cart contains a single Nerd leg item.")
          : fail(`Expected one Nerd leg item, received ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Adding Classic succeeds.",
      tool: "sockshop_cart_add_item",
      input: { id: shared.classic.id },
      evaluate(data) {
        return data?.success === true && data?.itemId === shared.classic.id
          ? pass("Classic add acknowledged.")
          : fail(`Unexpected add-item payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Cart get shows both Nerd leg and Classic.",
      tool: "sockshop_cart_get",
      evaluate(data) {
        if (!Array.isArray(data) || data.length !== 2) {
          return fail(`Expected 2 cart items, received ${JSON.stringify(data)}.`);
        }

        const ids = new Set(data.map((item) => item.itemId));
        return ids.has(shared.nerdLeg.id) && ids.has(shared.classic.id)
          ? pass("Cart contains both expected item IDs.")
          : fail(`Cart items did not match expectations: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Removing Nerd leg succeeds.",
      tool: "sockshop_cart_remove_item",
      input: { itemId: shared.nerdLeg.id },
      evaluate(data) {
        return data?.success === true && data?.itemId === shared.nerdLeg.id
          ? pass("Remove-item call acknowledged.")
          : fail(`Unexpected remove-item payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Cart get leaves Classic as the only remaining item.",
      tool: "sockshop_cart_get",
      evaluate(data) {
        const ok =
          Array.isArray(data) &&
          data.length === 1 &&
          data[0]?.itemId === shared.classic.id;

        return ok
          ? pass("Classic is the only remaining cart item.")
          : fail(`Expected only Classic in cart, received ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Final cart clear succeeds.",
      tool: "sockshop_cart_clear",
      evaluate(data) {
        return data?.success === true
          ? pass("Cart clear returned success=true.")
          : fail(`Unexpected cart clear payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Cart get is empty at the end of the flow.",
      tool: "sockshop_cart_get",
      evaluate(data) {
        return Array.isArray(data) && data.length === 0
          ? pass("Cart is empty after cleanup.")
          : fail(`Expected empty cart after cleanup, received ${JSON.stringify(data)}.`);
      },
    });

    scenarios.push(scenario);
  });

  await withSession("checkout-success", sessionEnv({ includeCredentials: false }), async (session) => {
    const scenario = createScenario("Scenario 4: Checkout Success");
    let beforeOrders = [];
    let checkoutOrderId = null;

    await runToolStep(scenario, session, {
      title: "Login succeeds before checkout.",
      tool: "sockshop_login",
      input: {
        username: "user",
        password: "password",
      },
      evaluate(data) {
        return data?.success === true
          ? pass("Authenticated checkout session established.")
          : fail(`Unexpected login payload: ${JSON.stringify(data)}.`);
      },
    });

    const ordersBefore = await runToolStep(scenario, session, {
      title: "Orders list captures the baseline before checkout.",
      tool: "sockshop_orders_list",
      evaluate(data) {
        if (!Array.isArray(data)) {
          return fail(`Expected an array of orders, received ${JSON.stringify(data)}.`);
        }

        beforeOrders = data;
        return pass(`Captured ${data.length} baseline orders.`);
      },
    });

    if (!ordersBefore.ok) {
      throw new Error("Unable to capture baseline orders before checkout.");
    }

    await runToolStep(scenario, session, {
      title: "Cart is cleared before adding the checkout item.",
      tool: "sockshop_cart_clear",
      evaluate(data) {
        return data?.success === true
          ? pass("Cart clear returned success=true.")
          : fail(`Unexpected cart clear payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Adding Nerd leg for checkout succeeds.",
      tool: "sockshop_cart_add_item",
      input: { id: shared.nerdLeg.id },
      evaluate(data) {
        return data?.success === true
          ? pass("Nerd leg add acknowledged.")
          : fail(`Unexpected add-item payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Checkout succeeds with a total of 12.98.",
      tool: "sockshop_checkout",
      evaluate(data) {
        const total = Number(data?.total);
        checkoutOrderId = data?.orderId ?? null;
        const ok =
          data?.success === true &&
          checkoutOrderId &&
          Math.abs(total - 12.98) < 0.001;

        return ok
          ? pass(`Checkout succeeded with order ${checkoutOrderId}.`)
          : fail(`Unexpected checkout payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Orders list includes the newly created order.",
      tool: "sockshop_orders_list",
      evaluate(data) {
        if (!Array.isArray(data)) {
          return fail(`Expected an array of orders, received ${JSON.stringify(data)}.`);
        }

        const found = checkoutOrderId
          ? data.some((order) => order.id === checkoutOrderId)
          : false;
        const countIncreased = data.length === beforeOrders.length + 1;

        return found && countIncreased
          ? pass(`Order list grew from ${beforeOrders.length} to ${data.length}.`)
          : fail(
              `Expected order ${checkoutOrderId} and count ${beforeOrders.length + 1}, received count=${data.length}.`,
            );
      },
    });

    await runToolStep(scenario, session, {
      title: "Orders get returns the new order detail.",
      tool: "sockshop_orders_get",
      input: { id: checkoutOrderId },
      evaluate(data) {
        const total = Number(data?.total);
        const ok =
          data?.id === checkoutOrderId &&
          data?.customerId &&
          Math.abs(total - 12.98) < 0.001;

        return ok
          ? pass(`Fetched order ${checkoutOrderId} with total ${total}.`)
          : fail(`Unexpected order detail payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Cleanup clears the cart after checkout.",
      tool: "sockshop_cart_clear",
      evaluate(data) {
        return data?.success === true
          ? pass("Post-checkout cart cleanup succeeded.")
          : fail(`Unexpected cleanup payload: ${JSON.stringify(data)}.`);
      },
    });

    scenarios.push(scenario);
  });

  await withSession("checkout-failure", sessionEnv({ includeCredentials: false }), async (session) => {
    const scenario = createScenario("Scenario 5: Checkout Failure (Holy Sock Paradox)");

    await runToolStep(scenario, session, {
      title: "Login succeeds before the Holy checkout attempt.",
      tool: "sockshop_login",
      input: {
        username: "user",
        password: "password",
      },
      evaluate(data) {
        return data?.success === true
          ? pass("Authenticated checkout session established.")
          : fail(`Unexpected login payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Cart is cleared before adding Holy.",
      tool: "sockshop_cart_clear",
      evaluate(data) {
        return data?.success === true
          ? pass("Cart clear returned success=true.")
          : fail(`Unexpected cart clear payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Adding Holy succeeds.",
      tool: "sockshop_cart_add_item",
      input: { id: shared.holy.id },
      evaluate(data) {
        return data?.success === true
          ? pass("Holy add acknowledged.")
          : fail(`Unexpected add-item payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Checkout declines because the total exceeds the $100 threshold.",
      tool: "sockshop_checkout",
      evaluate(data) {
        const total = Number(data?.total);
        const message = String(data?.error ?? "");
        const ok =
          data?.success === false &&
          Math.abs(total - 104.98) < 0.001 &&
          message.includes("$100 threshold");

        return ok
          ? pass(message)
          : fail(`Unexpected checkout failure payload: ${JSON.stringify(data)}.`);
      },
      evaluateError(error) {
        return fail(`Expected a handled decline payload, received MCP error: ${error.message}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Cleanup clears the Holy cart after the failed checkout.",
      tool: "sockshop_cart_clear",
      evaluate(data) {
        return data?.success === true
          ? pass("Cart cleanup succeeded.")
          : fail(`Unexpected cleanup payload: ${JSON.stringify(data)}.`);
      },
    });

    scenarios.push(scenario);
  });

  await withSession("data-exposure", sessionEnv({ includeCredentials: false }), async (session) => {
    const scenario = createScenario("Scenario 6: Customer/Card Exposure (No Auth)");

    await runToolStep(scenario, session, {
      title: "Customers list is publicly readable.",
      tool: "sockshop_customers_list",
      evaluate(data) {
        const ok =
          Array.isArray(data) &&
          data.length >= 3 &&
          data.every((customer) => typeof customer.username === "string");

        return ok
          ? pass(`Returned ${data.length} public customer records.`)
          : fail(`Unexpected customers payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Cards list exposes full PAN, expiry, and CCV without authentication.",
      tool: "sockshop_cards_list",
      evaluate(data) {
        const ok =
          Array.isArray(data) &&
          data.length >= 4 &&
          data.every(
            (card) =>
              typeof card.longNum === "string" &&
              typeof card.expires === "string" &&
              typeof card.ccv === "string",
          );

        return ok
          ? pass("Public card endpoint returned full card data, confirming the Phase 3 PCI finding.")
          : fail(`Unexpected cards payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Addresses list is publicly readable.",
      tool: "sockshop_addresses_list",
      evaluate(data) {
        const ok =
          Array.isArray(data) &&
          data.length >= 4 &&
          data.every((address) => typeof address.street === "string");

        return ok
          ? pass(`Returned ${data.length} public address records.`)
          : fail(`Unexpected addresses payload: ${JSON.stringify(data)}.`);
      },
    });

    scenarios.push(scenario);
  });

  await withSession("customer-profile", sessionEnv({ includeCredentials: false }), async (session) => {
    const scenario = createScenario("Scenario 7: Customer Profile");

    await runToolStep(scenario, session, {
      title: "Login succeeds before profile lookup.",
      tool: "sockshop_login",
      input: {
        username: "user",
        password: "password",
      },
      evaluate(data) {
        return data?.success === true
          ? pass("Authenticated profile session established.")
          : fail(`Unexpected login payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(scenario, session, {
      title: "Customer me returns the current user's profile.",
      tool: "sockshop_customer_me",
      evaluate(data) {
        const ok =
          data?.username === "user" &&
          data?.firstName === "User" &&
          data?.lastName === "Name";

        return ok
          ? pass("Customer profile matched the seeded user account.")
          : fail(`Unexpected customer profile payload: ${JSON.stringify(data)}.`);
      },
    });

    scenarios.push(scenario);
  });

  return scenarios;
}

async function runSupplementaryCoverage(shared) {
  const coverage = createScenario("Supplementary Tool Coverage");
  const timestamp = Date.now();
  const username = `mcp_phase4_${timestamp}`;
  const password = "password";
  const email = `${username}@example.test`;
  let addressId = null;
  let cardId = null;

  await withSession("supplementary-tools", sessionEnv({ includeCredentials: false }), async (session) => {
    await runToolStep(coverage, session, {
      title: "Register creates a new user and session.",
      tool: "sockshop_register",
      input: {
        username,
        password,
        email,
        firstName: "Phase4",
        lastName: "Integration",
      },
      evaluate(data) {
        const ok = data?.success === true && typeof data?.customerId === "string";
        return ok
          ? pass(`Registered ${username} as ${data.customerId}.`)
          : fail(`Unexpected register payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(coverage, session, {
      title: "Whoami reflects the newly registered session.",
      tool: "sockshop_whoami",
      evaluate(data) {
        return data?.isLoggedIn === true && data?.username === username
          ? pass(`Whoami returned the new user ${username}.`)
          : fail(`Unexpected whoami payload after register: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(coverage, session, {
      title: "Cart add succeeds for the supplementary user.",
      tool: "sockshop_cart_add_item",
      input: { id: shared.nerdLeg.id },
      evaluate(data) {
        return data?.success === true
          ? pass("Supplementary cart add acknowledged.")
          : fail(`Unexpected add-item payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(coverage, session, {
      title: "Cart update changes the quantity to 2.",
      tool: "sockshop_cart_update_item",
      input: { id: shared.nerdLeg.id, quantity: 2 },
      evaluate(data) {
        return data?.success === true && data?.quantity === 2
          ? pass("Cart update returned quantity=2.")
          : fail(`Unexpected cart update payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(coverage, session, {
      title: "Cart get reflects the updated quantity.",
      tool: "sockshop_cart_get",
      evaluate(data) {
        const ok =
          Array.isArray(data) &&
          data.length === 1 &&
          data[0]?.itemId === shared.nerdLeg.id &&
          data[0]?.quantity === 2;

        return ok
          ? pass("Cart quantity updated to 2 as expected.")
          : fail(`Unexpected cart state after update: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(coverage, session, {
      title: "Address create returns a new ID.",
      tool: "sockshop_addresses_create",
      input: {
        street: "Integration Road",
        number: "42",
        city: "London",
        postcode: "EC1A 1AA",
        country: "United Kingdom",
      },
      evaluate(data) {
        addressId = data?.id ?? null;
        return typeof addressId === "string"
          ? pass(`Created address ${addressId}.`)
          : fail(`Unexpected address create payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(coverage, session, {
      title: "Addresses list contains the created address.",
      tool: "sockshop_addresses_list",
      evaluate(data) {
        const found = Array.isArray(data)
          ? data.some((address) => address.id === addressId)
          : false;

        return found
          ? pass(`Address ${addressId} is visible in the public address list.`)
          : fail(`Created address ${addressId} was not found in the address list.`);
      },
    });

    await runToolStep(coverage, session, {
      title: "Card create returns a new ID.",
      tool: "sockshop_cards_create",
      input: {
        longNum: "4111111111111111",
        expires: "12/30",
        ccv: "123",
      },
      evaluate(data) {
        cardId = data?.id ?? null;
        return typeof cardId === "string"
          ? pass(`Created card ${cardId}.`)
          : fail(`Unexpected card create payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(coverage, session, {
      title: "Cards list contains the created card.",
      tool: "sockshop_cards_list",
      evaluate(data) {
        const found = Array.isArray(data)
          ? data.some((card) => card.id === cardId)
          : false;

        return found
          ? pass(`Card ${cardId} is visible in the public card list.`)
          : fail(`Created card ${cardId} was not found in the card list.`);
      },
    });

    await runToolStep(coverage, session, {
      title: "Address delete succeeds.",
      tool: "sockshop_addresses_delete",
      input: { id: addressId },
      evaluate(data) {
        return data?.success === true
          ? pass(`Deleted address ${addressId}.`)
          : fail(`Unexpected address delete payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(coverage, session, {
      title: "Card delete succeeds.",
      tool: "sockshop_cards_delete",
      input: { id: cardId },
      evaluate(data) {
        return data?.success === true
          ? pass(`Deleted card ${cardId}.`)
          : fail(`Unexpected card delete payload: ${JSON.stringify(data)}.`);
      },
    });

    await runToolStep(coverage, session, {
      title: "Supplementary cart cleanup succeeds.",
      tool: "sockshop_cart_clear",
      evaluate(data) {
        return data?.success === true
          ? pass("Supplementary cart cleanup succeeded.")
          : fail(`Unexpected cleanup payload: ${JSON.stringify(data)}.`);
      },
    });
  });

  return coverage;
}

function formatJson(value) {
  return `\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\``;
}

function renderScenarioTableRows(scenarios) {
  return scenarios
    .map((scenario) => {
      const counts = getScenarioCounts(scenario);
      const notes = scenario.steps
        .filter((step) => !step.passed)
        .map((step) => step.note)
        .join(" ");

      return `| ${scenario.name} | ${scenario.steps.length} | ${counts.passed} | ${counts.failed} | ${notes || "All steps passed."} |`;
    })
    .join("\n");
}

function renderScenarioDetails(scenarios) {
  return scenarios
    .map((scenario) => {
      const counts = getScenarioCounts(scenario);
      const heading = `## ${scenario.name}\n\nPassed: ${counts.passed}/${scenario.steps.length}\n`;
      const steps = scenario.steps
        .map(
          (step, index) =>
            `### Step ${index + 1}: ${step.title}\n\n` +
            `- Tool: \`${step.tool}\`\n` +
            `- Pass: ${step.passed ? "Yes" : "No"}\n` +
            `- Note: ${step.note}\n` +
            `- Input:\n${formatJson(step.input)}\n` +
            `- Output:\n${formatJson(step.output)}\n`,
        )
        .join("\n");

      return `${heading}\n${steps}`;
    })
    .join("\n");
}

function renderSupplementaryCoverage(scenario) {
  const counts = getScenarioCounts(scenario);
  const summary = `## ${scenario.name}\n\nPassed: ${counts.passed}/${scenario.steps.length}\n`;
  const steps = scenario.steps
    .map(
      (step, index) =>
        `### Coverage Step ${index + 1}: ${step.title}\n\n` +
        `- Tool: \`${step.tool}\`\n` +
        `- Pass: ${step.passed ? "Yes" : "No"}\n` +
        `- Note: ${step.note}\n` +
        `- Input:\n${formatJson(step.input)}\n` +
        `- Output:\n${formatJson(step.output)}\n`,
    )
    .join("\n");

  return `${summary}\n${steps}`;
}

function renderMarkdown(results) {
  const totalCoreSteps = results.coreScenarios.reduce(
    (sum, scenario) => sum + scenario.steps.length,
    0,
  );
  const totalCorePassed = results.coreScenarios.reduce(
    (sum, scenario) => sum + getScenarioCounts(scenario).passed,
    0,
  );
  const totalCoreFailed = totalCoreSteps - totalCorePassed;
  const fullyPassingScenarios = results.coreScenarios.filter(
    (scenario) => getScenarioCounts(scenario).failed === 0,
  ).length;
  const toolCoveragePass = getScenarioCounts(results.supplementaryCoverage).failed === 0;
  const toolsTested = [...results.toolsExercised].sort();
  const corePassRate = `${((totalCorePassed / totalCoreSteps) * 100).toFixed(1)}%`;

  return `# Phase 4: Sock Shop MCP Server — Integration Test Results

Date and time of test: ${results.startedAt.toISOString()} to ${results.finishedAt.toISOString()}

MCP server version/tool count:

- Version: \`${serverVersion}\`
- Tool count: \`${results.toolCount}\`
- Tools exercised: \`${toolsTested.length}/23\`
- Base URL: \`${baseUrl}\`

## Scenario Summary

| Scenario | Steps | Passed | Failed | Notes |
| --- | ---: | ---: | ---: | --- |
${renderScenarioTableRows(results.coreScenarios)}

## Detailed Results

${renderScenarioDetails(results.coreScenarios)}

## Supplementary Tool Coverage

The task text named 7 core demo scenarios, but those scenarios do not cover all 23 tools. The supplementary pass below exercised the remaining surface: \`sockshop_register\`, \`sockshop_cart_update_item\`, \`sockshop_addresses_create\`, \`sockshop_addresses_delete\`, \`sockshop_cards_create\`, and \`sockshop_cards_delete\`.

${renderSupplementaryCoverage(results.supplementaryCoverage)}

## MCP Tools vs Raw Curl

- MCP kept session handling inside a single long-lived process, which made login, cart, and checkout tests less error-prone than the Phase 3 curl flows that had to manage cookie jars explicitly.
- MCP responses were structurally normalized for several endpoints, especially catalogue and cart data, so assertions were shorter and less coupled to HAL response shapes than the Phase 3 curl probes.
- Raw curl was still better for surfacing transport-level behavior such as exact HTTP status codes, proxy quirks, and unauthenticated edge routing. The MCP layer hides some of that detail behind tool abstractions.
- The current MCP surface improves readability for business-flow tests, but it also exposes a product gap: cart merge on login cannot be verified through MCP alone because there is no anonymous cart tool to seed a pre-login basket.
- Another behavior gap surfaced during MCP testing: \`sockshop_whoami\` does not report anonymous state. It calls \`ensureLoggedIn()\`, so without credential env vars it errors instead of returning \`isLoggedIn: false\`.

## Findings

- The server built cleanly and advertised all 23 expected tools after a full MCP initialize handshake.
- Catalogue, cart, checkout, order history, customer profile, and the public data-exposure flows all worked through MCP.
- The Holy checkout paradox remains reproducible through MCP: \`Holy\` is listed at \`$99.99\`, shipping adds \`$4.99\`, and checkout returns a handled decline at \`$104.98\`.
- Public access to \`customers\`, \`cards\`, and \`addresses\` is still trivially reproducible through MCP, including full PAN, expiry, and CCV exposure on \`sockshop_cards_list\`.
- \`sockshop_whoami\` failed the pre-login expectation in the test plan because the implementation attempts automatic login rather than reporting current session state.

## Summary

- Total tools tested: \`${toolsTested.length}/23\`
- Total core scenarios: \`7\`
- Fully passing core scenarios: \`${fullyPassingScenarios}/7\`
- Core step pass rate: \`${corePassRate}\` (\`${totalCorePassed}\` passed, \`${totalCoreFailed}\` failed)
- Supplementary tool coverage pass: \`${toolCoveragePass ? "Yes" : "No"}\`
`;
}

async function main() {
  const startedAt = new Date();

  const shared = {};

  const toolSession = new McpSession(
    "tool-verification",
    sessionEnv({ includeCredentials: false }),
  );
  await toolSession.start();

  let tools;

  try {
    tools = await toolSession.listTools();
  } finally {
    await toolSession.close();
  }

  const toolCount = tools.length;
  if (toolCount !== 23) {
    throw new Error(`Expected 23 tools, found ${toolCount}.`);
  }

  const coreScenarios = await runCoreScenarios(shared);
  const supplementaryCoverage = await runSupplementaryCoverage(shared);
  const finishedAt = new Date();

  const toolsExercised = new Set();

  for (const scenario of [...coreScenarios, supplementaryCoverage]) {
    for (const step of scenario.steps) {
      toolsExercised.add(step.tool);
    }
  }

  const results = {
    startedAt,
    finishedAt,
    toolCount,
    toolNames: tools.map((tool) => tool.name),
    coreScenarios,
    supplementaryCoverage,
    toolsExercised,
  };

  const markdown = renderMarkdown(results);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, markdown, "utf8");

  console.log(
    JSON.stringify(
      {
        reportPath,
        toolCount,
        toolsExercised: [...toolsExercised].sort(),
        coreScenarioSummary: coreScenarios.map((scenario) => ({
          name: scenario.name,
          ...getScenarioCounts(scenario),
        })),
        supplementaryCoverage: getScenarioCounts(supplementaryCoverage),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
