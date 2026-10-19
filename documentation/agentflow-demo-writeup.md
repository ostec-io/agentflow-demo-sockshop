# AgentFlow: Cognitive Orchestration in Action

## What AgentFlow Is

AgentFlow is a cognitive orchestration engine. It coordinates fleets of AI agents through structured pipelines — sprints, tasks, triggers, memory, tools — to execute complex multi-step work autonomously. The platform doesn't care what domain it's pointed at. The orchestration layer is constant; the agents, tools, and targets change.

This document captures the demonstrations that prove it.

---

## The Demonstrations

### 1. API Assembly Line — Code Generation from PRDs

**What it does:** Takes a Product Requirements Document and produces a complete, structured Spring Boot Java codebase (generated, not yet compiled or tested) through a multi-phase pipeline.

**The pipeline:**
1. DDD Specification — domain-driven design analysis from the PRD
2. Component Outline — service boundaries, API contracts, data models
3. Code Generation — full Java Spring Boot implementation

**What was built:** A PetStore API (Spring Boot 3.3, Java 21, MongoDB, Kafka) with catalogue management, ordering, audit trails, multi-tenancy, and OpenAPI documentation.

**Key stat:** 19,000+ lines of Java generated from a single PRD. Referenced in the pentest demo as proof of AgentFlow's versatility — "Last week, this same platform architecture built a 19,000-line Java Spring Boot codebase from a product requirements document."

---

### 2. Autonomous Penetration Test — OWASP Juice Shop

**Repository:** [github.com/ostec-io/agentflow-pentest-juiceshop](https://github.com/ostec-io/agentflow-pentest-juiceshop)

**What it does:** AgentFlow executes a complete PTES-methodology penetration test against OWASP Juice Shop with zero human intervention after initial setup.

**The pipeline (7 phases, about 71 minutes — the clean run, run 10):**
| Phase | Duration | What Happened |
|-------|----------|---------------|
| Phase 0: Setup | ~2 min | Tool inventory, target validation |
| Phase 1: Reconnaissance | ~11 min | Endpoint mapping, technology fingerprinting |
| Phase 2: Scanning | ~16 min | Port scans, vulnerability scans, directory enumeration |
| Phase 3: Web Analysis | ~25 min | OWASP Top 10 testing, injection testing, auth testing |
| Phase 4: Exploitation | ~23 min | Controlled exploitation, evidence collection |
| Phase 5: Post-Exploitation | ~14 min | Re-validation, data exposure quantification |
| Phase 6: Reporting | ~7 min | PTES report, executive summary, findings database |

**Results:**
| Metric | Value |
|--------|-------|
| Total vulnerabilities | 16 |
| Critical | 3 (SQLi CVSS 9.1, Mass Assignment CVSS 9.8, JWT Bypass CVSS 9.4) |
| High | 7 |
| Medium | 5 |
| Low | 1 |
| Exploits attempted | 11 |
| Exploits successful | 9 (82% success rate) |
| User records exposed | 30 |
| Payment card records exposed | 6 |
| Database tables enumerable | 21 |
| Report length | 730 lines |
| Human intervention | Zero after setup |

**Security controls:** All tools ran in Docker with `--cap-drop=ALL`, read-only filesystems, and privilege escalation prevention. Professional-grade hardened execution.

---

### 3. Open Source Codebase Analysis — VS Code, Kubernetes, Grafana, DefinitelyTyped

**Projects:**
- **VS Code** — Microsoft's open-source editor (~40M+ lines)
- **Kubernetes** — Container orchestration platform (~4M+ lines of Go)
- **Grafana** — Observability platform (~2M+ lines)
- **DefinitelyTyped** — TypeScript type definitions (~50K+ packages)

**What AgentFlow does:** Points at massive open-source codebases and runs automated analysis pipelines — architecture mapping, issue investigation, and change request generation. Each project has a workspace with:
- `documentation/` — generated analysis reports
- `issues/` — investigated issues
- `change-requests/` — proposed changes
- `reports/` — execution status
- `PRDs/` — product requirement documents for changes

**The point:** AgentFlow can navigate and reason about codebases at scales that are impractical for individual developers. The same orchestration that generates code and runs pentests also performs deep codebase analysis.

---

### 4. Sock Shop — The Cognitive Intelligence Layer (This Demo)

**What it does:** AgentFlow is pointed at a live 8-service microservices e-commerce application (Weaveworks Sock Shop) and builds a complete cognitive intelligence layer — from static analysis to live API interaction to typed MCP tools — with zero code changes to the target application.

#### Phase 1: Codebase Reconnaissance
- 8 per-service deep-dive analyses (catalogue, carts, orders, user, payment, shipping, frontend, infrastructure)
- 3 cross-cutting synthesis reports (dependencies, security, performance)
- Discovered: complete API surface, 16 HTTP dependency edges + RabbitMQ async, data models across 4 databases, 22 security vulnerabilities (5 critical)

#### Phase 2: Live API Probes
- 5 agents probed the running application in parallel
- Confirmed: all 14 containers running, response time baselines (catalogue 9ms, customers 7ms, orders 39ms), catalogue health endpoint degraded, all security findings confirmed live

#### Phase 3: Cognitive Intelligence Layer
**Sprint 1 (parallel, 5 agents):**
| Agent | What It Produced |
|-------|-----------------|
| Order Intelligence Analyst | Revenue analysis, product popularity, temporal patterns, basket analysis |
| Fraud Detection Analyst | PCI violations, expired cards processing payments, user risk profiles |
| Inventory Intelligence Analyst | Stock levels, demand forecasting, the "Holy Sock Paradox" |
| Customer Intelligence Agent | Customer profiles, 5 simulated AI customer service interactions |
| Operations Intelligence Agent | Performance baselines, concurrency testing, infrastructure assessment |

**Sprint 2 (sequential, 3 agents):**
| Agent | What It Produced |
|-------|-----------------|
| Chief Intelligence Officer | Cross-domain executive synthesis — insights no single agent could find alone |
| Real-Time Fraud Detection Agent | Live order creation + real-time analysis, Holy Sock Paradox confirmed |
| Demo Narrator | Complete 3-act narrative across all phases |

**The Key Discoveries:**
1. **The Holy Sock Paradox** — The most expensive product ($99.99) + flat shipping ($4.99) = $104.98, which exceeds the $100 payment threshold. A product that exists in the catalogue but is mathematically impossible to purchase. Discovered by correlating inventory, payment, and shipping data across 3 agents.
2. **Expired Cards Processing Payments** — All stored cards expired in 2019, yet orders process successfully. The payment service only checks amount, not card validity.
3. **Single Customer Revenue Concentration** — Nearly all revenue from one customer. Total business risk.
4. **The Open API Paradox** — The same API openness that enables AgentFlow's intelligence (no auth on /customers, /cards, /addresses) is also the biggest security vulnerability. The tool that finds the problem IS the problem.

#### Phase 4: MCP Tool Layer
Built a custom Model Context Protocol server that wraps all Sock Shop gateway APIs as typed, structured tools:
- **23 MCP tools** across 7 domains (catalogue, cart, orders, auth, users, addresses, cards)
- **TypeScript/Node.js** with `@modelcontextprotocol/sdk`, stdio transport
- **Gateway session auth** — persists `md.sid` + `logged_in` cookies, handles cart merge on login
- **1,989 lines of TypeScript** across 10 source files
- Registered in AgentFlow as a tool config — agents can now call `sockshop_catalogue_list` instead of crafting curl commands
- **Agent verification test**: A Codex agent completed a full intelligence sweep (catalogue recon, security audit, shopping flow, Holy Sock Paradox confirmation) using ONLY MCP tools — zero curl commands

#### Sock Shop Stats
| Metric | Value |
|--------|-------|
| Documentation produced | 26 reports, 6,880 lines, 320KB |
| Sprints executed | 7 (across Phases 3-4) |
| Agent tasks (Phases 3–4) | 17 (Phase 3: 8, Phase 4: 8, MCP test: 1) |
| MCP tools built | 23 |
| TypeScript source | 1,989 lines across 10 files |
| Code review tasks | 1 autonomous review, 6 findings (4 High, 2 Medium) |
| Lines of Sock Shop code changed | 0 |
| APIs added to Sock Shop | 0 |
| Infrastructure modified | 0 |

---

## The Platform Behind It All

**53 projects** registered in AgentFlow spanning:
- Open-source analysis (VS Code, Kubernetes, Grafana, DefinitelyTyped)
- Code generation (API Assembly Line, FocusFlow)
- Security testing (Juice Shop pentest)
- Cognitive intelligence (Sock Shop)
- Product development (RouteIQ, Locactus, Signal Wars, Argus Trading, LISA Tutoring, NeuroSwift, Boditree, Drift)
- Infrastructure (OSTEC Foundation with 22 repos, Hive, AgentFlow Core/Sentinel/Events/Assist/Connect/Academy/IDE Companion/CLI)
- Demo & testing (ServiceNow Integration, Minecraft MCP, BPMN Integration Testing, Prompt Injector Isolation)

**The constant:** AgentFlow's orchestration engine. Sprints, tasks, triggers, memory, tools, agents. The domain changes. The engine doesn't.

---

## The Problem AgentFlow Solves

Claude Code and Codex are overpowered. One agent can analyse a codebase, write production code, run tests, and reason about complex systems. The problem isn't capability — it's coordination.

Try running 5 Codex agents in parallel on different parts of the same problem. You'll have 5 terminal windows open, manually copy-pasting context between them, tracking which one finished, sequencing the next step, losing track of outputs, and spending more time orchestrating than building. Scale that to 17 agents across 7 sprints and it's unmanageable. For a raw look at what this feels like before AgentFlow — thirty terminals, verbose mode, catching context fade in real time — read [30 Terminals, Verbose Mode, and Why I Watch AI Think](https://medium.com/@ossie_29843/30-terminals-verbose-mode-and-why-i-watch-ai-think-eb9ecfc5deee).

AgentFlow handles that. Sprints handle sequencing. Parallel execution handles concurrency. Triggers chain sprints automatically. Memory shares context between agents. Tool configs control what each agent can access. The human provides direction and light oversight — the platform handles the coordination at scale.

In the Sock Shop demo, one person set up the tasks and sprint structure. AgentFlow then ran 17 agents across 7 sprints, producing 26 reports, building 23 MCP tools, and running an autonomous code review — all while the human watched it flow through. Light touch orchestration of heavy-duty AI execution.

That's the gap: not smarter agents, but structured coordination of the ones we already have.

---

## The Punchline

AgentFlow is domain-agnostic cognitive orchestration. In the demos above, the same platform:

1. **Generated** 19,000 lines of Java from a PRD (generated, not yet compiled or tested)
2. **Penetration tested** a web application, finding 16 vulnerabilities including 3 critical (CVSS 9.1-9.8)
3. **Analysed** codebases with millions of lines (VS Code, Kubernetes, Grafana)
4. **Built a cognitive intelligence layer** on top of a live microservices application with zero code changes
5. **Constructed its own API tooling** (23 MCP tools) so future agents interact through typed interfaces instead of raw HTTP

All autonomous. All structured. All auditable.

The agents change. The tools change. The targets change. The orchestration engine stays the same.

That's AgentFlow.
