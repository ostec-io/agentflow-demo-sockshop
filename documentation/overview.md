# Documentation Overview

This directory contains the complete output of AgentFlow's autonomous analysis of the Weaveworks Sock Shop microservices platform. 26 reports produced across 4 phases (6,880 lines), plus this index and the master write-up.

## Master Writeup

- [agentflow-demo-writeup.md](./agentflow-demo-writeup.md) — The master narrative covering all AgentFlow demonstrations, with the Sock Shop as demo #4

---

## Phase 1: Codebase Reconnaissance

8 per-service deep dives + 3 cross-cutting synthesis reports. Agents analysed all 9 repositories without running any code.

### Service Analyses
- [service-catalogue.md](./phase1-reconnaissance/service-catalogue.md) — Go catalogue service: REST endpoints, MySQL schema, tag filtering
- [service-carts.md](./phase1-reconnaissance/service-carts.md) — Java/Spring cart service: CRUD operations, MongoDB persistence, merge logic
- [service-orders.md](./phase1-reconnaissance/service-orders.md) — Java/Spring order service: checkout flow, parallel service calls, 5s timeouts
- [service-payment.md](./phase1-reconnaissance/service-payment.md) — Go payment service: $100 authorisation threshold, no card validation
- [service-shipping.md](./phase1-reconnaissance/service-shipping.md) — Java/Spring shipping service: RabbitMQ integration, $4.99 flat rate
- [service-user.md](./phase1-reconnaissance/service-user.md) — Go user service: SHA-1 passwords, public endpoints, session management
- [service-frontend.md](./phase1-reconnaissance/service-frontend.md) — Node.js front-end: API gateway proxying, session handling, routing
- [service-infrastructure.md](./phase1-reconnaissance/service-infrastructure.md) — Docker Compose stack: 14 containers, 4 databases, networking

### Synthesis Reports
- [synthesis-dependencies.md](./phase1-reconnaissance/synthesis-dependencies.md) — 16 HTTP dependency edges + RabbitMQ async, critical order placement path
- [synthesis-security.md](./phase1-reconnaissance/synthesis-security.md) — 22 vulnerabilities found (5 critical): plaintext cards, public PII endpoints, SHA-1 passwords
- [synthesis-performance.md](./phase1-reconnaissance/synthesis-performance.md) — No caching, no retries, no circuit breakers, no health checks — fragility assessment

---

## Phase 2: Live API Probes

5 agents probed the running Sock Shop in parallel, confirming findings from Phase 1 against real API responses.

- [live-health-baseline.md](./phase2-live-probes/live-health-baseline.md) — Health monitoring, response time baselines (catalogue 9ms, orders 39ms)
- [live-catalogue-inventory.md](./phase2-live-probes/live-catalogue-inventory.md) — Full inventory snapshot, schema validation, image availability
- [live-order-analysis.md](./phase2-live-probes/live-order-analysis.md) — Order history analysis, end-to-end order creation and verification
- [live-cart-operations.md](./phase2-live-probes/live-cart-operations.md) — Cart CRUD testing, anonymous-to-authenticated merge behaviour
- [live-user-auth.md](./phase2-live-probes/live-user-auth.md) — Authentication flow audit, data exposure assessment on public endpoints

---

## Phase 3: Cognitive Intelligence Layer

Specialist agents performed deep domain analysis, followed by cross-domain synthesis. This phase produced the headline discoveries.

### Intelligence Reports
- [intel-order-patterns.md](./phase3-intelligence/intel-order-patterns.md) — Revenue analysis, product popularity rankings, temporal order patterns
- [intel-fraud-detection.md](./phase3-intelligence/intel-fraud-detection.md) — PCI violations, expired cards still processing, user risk profiling
- [intel-inventory-demand.md](./phase3-intelligence/intel-inventory-demand.md) — Stock level analysis, demand forecasting, the **Holy Sock Paradox** discovery
- [intel-customer-profiles.md](./phase3-intelligence/intel-customer-profiles.md) — Customer intelligence profiles, 5 simulated AI customer interactions
- [intel-ops-health.md](./phase3-intelligence/intel-ops-health.md) — Performance baselines, concurrency testing, infrastructure health assessment
- [intel-executive-synthesis.md](./phase3-intelligence/intel-executive-synthesis.md) — Cross-domain executive brief synthesising insights across all agents
- [intel-live-anomaly-demo.md](./phase3-intelligence/intel-live-anomaly-demo.md) — Real-time fraud detection: live order creation + immediate anomaly analysis

### Narrative
- [phase3-demo-narrative.md](./phase3-intelligence/phase3-demo-narrative.md) — Complete 3-act narrative (Discovery, Observation, Intelligence) across all phases

---

## Phase 4: MCP Server

AgentFlow built a 23-tool MCP server wrapping the entire Sock Shop API surface, then tested it autonomously.

- [phase4-mcp-integration-test.md](./phase4-mcp-server/phase4-mcp-integration-test.md) — 23 tools tested across 7 scenarios, 38 test steps with pass/fail results
- [phase4-agent-mcp-test.md](./phase4-mcp-server/phase4-agent-mcp-test.md) — Agent verification: a Codex agent completed a full intelligence sweep using only MCP tools
