# AgentFlow + Sock Shop: Autonomous Microservices Intelligence

> AgentFlow pointed 17 AI agents at a live 8-service e-commerce platform.
> They produced 26 reports, discovered 22 security vulnerabilities,
> found an unpurchasable product, and built 23 MCP tools —
> all without changing a single line of Sock Shop code.

## What This Is

[AgentFlow](https://agentflow.ostec.io) is a cognitive orchestration engine that coordinates fleets of AI agents through structured pipelines — sprints, tasks, triggers, memory, and tools — to execute complex multi-step work autonomously.

[Sock Shop](https://github.com/microservices-demo/microservices-demo) is a microservices reference application by Weaveworks: an e-commerce store that sells socks, built with Go, Java/Spring Boot, and Node.js across 8 services, 4 databases, and a message queue.

This repository contains everything AgentFlow produced when pointed at the Sock Shop. From static codebase analysis, through live API probing, to cognitive intelligence synthesis, to a fully typed MCP tool server — built autonomously across 7 sprints with zero human code changes.

---

## The Headline Discoveries

### The Holy Sock Paradox

The most expensive product ("Holy") costs **$99.99**. Flat shipping is **$4.99**. Order total: **$104.98**. The payment service rejects anything over **$100**. Result: a product that exists in the catalogue, shows as in-stock, can be added to cart — but is mathematically impossible to purchase. Discovered by correlating data across 3 independent agents analysing inventory, payment rules, and shipping costs.

### Expired Cards Still Processing Payments

Every stored card in the system expired in 2019. Yet orders process successfully in 2026. The payment service checks only the amount — never the card validity, expiry date, or even the card number.

### The Open API Paradox

The endpoints `/customers`, `/cards`, and `/addresses` require no authentication. Full PII, PANs, and CVVs are exposed to any caller. The same API openness that enables AgentFlow's intelligence gathering is the system's biggest security vulnerability. **The tool that finds the problem IS the problem.**

---

## What AgentFlow Did

| Phase | Agents | What Happened | Output |
|-------|--------|---------------|--------|
| **1. Reconnaissance** | 8 parallel | Static analysis of all 9 repos — endpoints, data models, dependencies, security | 11 reports |
| **2. Live Probes** | 5 parallel | Probed running services — health checks, response times, API behaviour | 5 reports |
| **3. Intelligence** | 8 across 2 sprints | Domain-specific analysis + cross-domain synthesis | 8 reports |
| **4. MCP Server** | 9 across 2 sprints | Built and tested 23 MCP tools wrapping the full API surface | 1,989 lines TypeScript |

### Phase 1: Codebase Reconnaissance

8 agents each analysed a different service, producing deep-dive reports on endpoints, data models, configuration, and implementation patterns. 3 synthesis agents then produced cross-cutting analyses of dependencies (16 HTTP edges + RabbitMQ), security (22 vulnerabilities, 5 critical), and performance (no caching, no retries, no circuit breakers).

### Phase 2: Live API Probes

5 agents probed the running application in parallel — catalogue inventory, cart operations, order flows, user auth, and health baselines. Confirmed all Phase 1 findings against live data. Established response time baselines: catalogue 9ms, customers 7ms, orders 39ms.

### Phase 3: Cognitive Intelligence Layer

**Sprint 1** — 5 specialist agents ran in parallel:

| Agent | Key Finding |
|-------|-------------|
| Order Intelligence | 100% of revenue from single customer account |
| Fraud Detection | All cards expired, PCI violations across every endpoint |
| Inventory Intelligence | Holy Sock Paradox — unpurchasable product |
| Customer Intelligence | Single-customer concentration risk |
| Operations Intelligence | No resilience patterns, 5s timeouts as only protection |

**Sprint 2** — 3 synthesis agents:

| Agent | Output |
|-------|--------|
| Chief Intelligence Officer | Cross-domain executive brief — insights no single agent could produce alone |
| Real-Time Fraud Detection | Live order creation + immediate anomaly analysis |
| Demo Narrator | Complete 3-act narrative across all phases |

### Phase 4: MCP Tool Construction

Built a custom [Model Context Protocol](https://modelcontextprotocol.io/) server wrapping all Sock Shop gateway APIs as typed, structured tools. 23 tools across 7 domains. Then ran autonomous integration tests (38 steps, 7 scenarios) and an agent verification test where a Codex agent completed a full intelligence sweep using only MCP tools — zero curl commands.

---

## Quick Start

### Run the full stack (Sock Shop + MCP Server)

```bash
# Clone this repo
git clone git@github.com:ostec-io/agentflow-demo-sockshop.git
cd agentflow-demo-sockshop

# Start Sock Shop + MCP server
docker compose -f deploy/docker-compose/docker-compose.yml \
               -f deploy/docker-compose/docker-compose.mcp.yml up -d

# Sock Shop UI:        http://localhost:8888
# MCP Server (SSE):    http://localhost:3001/sse
# MCP Health Check:    http://localhost:3001/health
```

### Use with Claude Desktop (stdio mode)

```bash
cd sockshop-mcp
npm install
npm run build
```

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "sockshop": {
      "command": "node",
      "args": ["/path/to/agentflow-demo-sockshop/sockshop-mcp/dist/index.js"],
      "env": {
        "SOCKSHOP_BASE_URL": "http://localhost:8888",
        "SOCKSHOP_USERNAME": "user",
        "SOCKSHOP_PASSWORD": "password"
      }
    }
  }
}
```

### Use with AgentFlow

Register the MCP server as a tool config pointing at the SSE endpoint (`http://localhost:3001/sse`), and any AgentFlow agent can call the 23 Sock Shop tools directly.

---

## MCP Tools (23)

| Domain | Tool | Description |
|--------|------|-------------|
| **Auth** | `sockshop_login` | Session-cookie login |
| | `sockshop_register` | Register new user + establish session |
| | `sockshop_whoami` | Current session state (auto-login) |
| **Catalogue** | `sockshop_catalogue_list` | List products (filter by tags, paginate) |
| | `sockshop_catalogue_get` | Get product by UUID |
| | `sockshop_catalogue_size` | Product count (optional tag filter) |
| | `sockshop_tags_list` | List available tags |
| **Cart** | `sockshop_cart_get` | List cart items |
| | `sockshop_cart_add_item` | Add product to cart |
| | `sockshop_cart_update_item` | Update item quantity |
| | `sockshop_cart_clear` | Clear all cart items |
| | `sockshop_cart_remove_item` | Remove item from cart |
| **Orders** | `sockshop_orders_list` | List user's orders |
| | `sockshop_orders_get` | Get order by ID |
| | `sockshop_checkout` | Place order ($100 limit, $4.99 shipping) |
| **Cards** | `sockshop_cards_list` | List all cards (public!) |
| | `sockshop_cards_create` | Create card for user |
| | `sockshop_cards_delete` | Delete card |
| **Users** | `sockshop_customers_list` | List all customers (public!) |
| | `sockshop_customer_me` | Current user profile |
| | `sockshop_addresses_list` | List all addresses (public!) |
| | `sockshop_addresses_create` | Create address for user |
| | `sockshop_addresses_delete` | Delete address |

Full parameter reference: [architecture/mcp-tool-reference.md](./architecture/mcp-tool-reference.md)

---

## By the Numbers

| Metric | Value |
|--------|-------|
| Documentation produced | 26 reports, 6,880 lines |
| Sprints executed | 7 |
| Agent tasks tracked | 50 |
| MCP tools built | 23 |
| TypeScript source | 1,989 lines across 10 files |
| Security vulnerabilities found | 22 (5 critical) |
| Integration test steps | 38 across 7 scenarios |
| Lines of Sock Shop code changed | **0** |
| APIs added to Sock Shop | **0** |
| Infrastructure modified | **0** |

---

## Repository Structure

```
agentflow-demo-sockshop/
├── README.md                        # This file
├── LICENSE                          # Apache 2.0
│
├── sockshop-mcp/                    # MCP server (23 tools, TypeScript)
│   ├── Dockerfile                   # Multi-stage Node 22 build
│   ├── src/index.ts                 # Stdio transport (Claude Desktop)
│   ├── src/server-http.ts           # SSE transport (Docker/network)
│   └── src/tools/                   # Tool implementations
│
├── deploy/
│   └── docker-compose/
│       ├── docker-compose.yml       # Original Sock Shop (14 containers)
│       └── docker-compose.mcp.yml   # Override: adds MCP server
│
├── documentation/                   # All 26 AgentFlow-produced reports
│   ├── overview.md                  # Navigation index
│   ├── agentflow-demo-writeup.md    # Master writeup
│   ├── phase1-reconnaissance/       # 11 files — static analysis
│   ├── phase2-live-probes/          # 5 files — live API observation
│   ├── phase3-intelligence/         # 8 files — cognitive intelligence
│   └── phase4-mcp-server/           # 2 files — MCP test results
│
└── architecture/                    # Reference documentation
    ├── mcp-tool-reference.md        # All 23 tools with parameters
    └── service-topology.md          # Service dependency map (Mermaid)
```

## Documentation Guide

Start with [documentation/overview.md](./documentation/overview.md) for a navigable index of all 26 reports, organized by phase.

Key reads:
- **The full story**: [documentation/phase3-intelligence/phase3-demo-narrative.md](./documentation/phase3-intelligence/phase3-demo-narrative.md)
- **Security findings**: [documentation/phase1-reconnaissance/synthesis-security.md](./documentation/phase1-reconnaissance/synthesis-security.md)
- **Executive brief**: [documentation/phase3-intelligence/intel-executive-synthesis.md](./documentation/phase3-intelligence/intel-executive-synthesis.md)
- **MCP test results**: [documentation/phase4-mcp-server/phase4-mcp-integration-test.md](./documentation/phase4-mcp-server/phase4-mcp-integration-test.md)

---

## About AgentFlow

AgentFlow is domain-agnostic cognitive orchestration. The same platform that built this intelligence layer also:

- Generated 19,000 lines of Java from a PRD (generated, not yet compiled or tested) ([assembly-line-demo](https://github.com/ostec-io/assembly-line-demo))
- Penetration-tested OWASP Juice Shop, finding 16 vulnerabilities including 3 critical ([agentflow-pentest-juiceshop](https://github.com/ostec-io/agentflow-pentest-juiceshop))
- Analysed codebases with millions of lines: VS Code, Kubernetes, Grafana, DefinitelyTyped

The agents change. The tools change. The targets change. The orchestration engine stays the same.

Built by [OSTEC](https://ostec.io).
