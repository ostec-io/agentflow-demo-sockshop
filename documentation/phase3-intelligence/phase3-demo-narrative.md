# Phase 3 Demo Narrative — The Complete AgentFlow Story

Generated: 2026-03-17  
Project: Sock Shop Demo  
Scope: Phase 1 reconnaissance, Phase 2 live observation, Phase 3 cognitive intelligence

## Opening: What Is AgentFlow?

AgentFlow is a cognitive orchestration engine. You point it at an existing application, let it investigate through the interfaces the application already exposes, and it builds an intelligence layer on top without changing the target system itself.

That is the point of this Sock Shop demo. The application under test was not rewritten, extended, or instrumented with bespoke AI hooks. AgentFlow plugged into the APIs that were already there, learned the system, validated its understanding against live traffic, then layered order intelligence, fraud detection, customer insight, inventory forecasting, and operational reasoning on top. Zero code changes to Sock Shop. Zero new APIs. Zero infrastructure changes.

## Act 1: Discovery

Phase 1 began with AgentFlow pointed at Sock Shop, an eight-service microservices e-commerce platform composed of a Node.js front end, Go and Java business services, four backing data stores, and a RabbitMQ-driven shipping pipeline. The reconnaissance campaign itself ran across four analysis sprints, then a synthesis sprint consolidated the results. Five agents iterated through the codebase three times sequentially, then fanned out in parallel for the deep dive that produced the definitive service reports.

What came out of that reconnaissance was a complete machine-readable understanding of the platform. Across more than 620 source and deployment files, AgentFlow documented 52 distinct routes across the gateway and backend services, mapped 16 HTTP service-to-service edges plus the RabbitMQ async shipping path, and reconstructed the data model spanning MySQL, MongoDB, Redis-backed sessions, and broker state. The order path emerged as the core business flow: front-end to orders, fan-out to user and carts, then payment, shipping, MongoDB persistence, and asynchronous queue consumption.

The more important discovery was not just topology but weakness. The security synthesis surfaced more than 20 vulnerabilities, ultimately catalogued as 22 findings with 5 critical: plaintext card storage, SHA-1 password hashing, SSRF in order creation, a hardcoded session secret, and total absence of inter-service authentication. The performance synthesis marked the platform as fragile: no caching, no retries, no health checks in compose, non-durable queueing, and a synchronous order pipeline that would become the bottleneck the moment real traffic appeared. By the end of Phase 1, AgentFlow had not changed Sock Shop, but it already understood the system well enough to predict where reality would break.

## Act 2: Observation

Phase 2 moved from code to reality. AgentFlow connected to the live Sock Shop deployment through `http://localhost:8888` and sent five agents to probe the running system in parallel. Their job was simple: verify that the code-level model from Phase 1 matched what the software was actually doing in production-like conditions.

The live probes confirmed the platform was up, but they also confirmed that the weaknesses were real. All 14 containers were running. Across the five probe reports, AgentFlow exercised 33 endpoint paths, captured 15 baseline latency measurements, and confirmed 31 live anomalies, defects, or security exposures. The baseline latency numbers matched the architecture: catalogue averaged about 9 ms, customers about 7 ms, and orders about 39 ms, immediately identifying orders as the slowest public path because it fans out across services. The catalogue health endpoint was degraded, returning a database-related error while catalogue data still served normally. That is exactly the kind of contradiction static analysis cannot prove on its own.

Phase 2 also turned suspected security problems into observed ones. The user service exposed `/customers`, `/cards`, and `/addresses` without authentication. Cards were returned with full PAN, expiry, and CCV values. Order details embedded the same sensitive card data in plaintext. Live cart probes showed ghost items could be added with invalid identifiers and zero price, delete semantics were inconsistent, and cart item IDs were unstable across mutations. Order probes confirmed a live payment threshold of `$100.00`, a flat shipping charge of `$4.99`, successful end-to-end checkout, and the fact that all observed revenue belonged to one customer. Observation did not merely validate the model. It proved the model was exploitable.

## Act 3: Intelligence

Phase 3 is where AgentFlow stopped being a reconnaissance tool and became a cognitive layer. Five specialist agents were deployed in parallel in Sprint 1, each focused on a different domain: Order Analyst, Fraud Detector, Inventory Monitor, Customer Intelligence, and Ops Intelligence. Sprint 2 then moved sequentially through cross-domain synthesis, a live anomaly detection demo, and this final narrative.

Each specialist produced a standalone intelligence product. Order analysis reconstructed revenue, basket shape, timestamp clustering, and customer concentration across the live order history. Fraud detection converted open APIs and broken validation into user-level risk profiles. Inventory intelligence combined catalogue state, demand velocity, shipping, and payment behavior to forecast stock health and replenishment need. Customer intelligence built live customer profiles and simulated support responses from gateway data already present in the system. Ops intelligence produced a live health scorecard, concurrency degradation profile, and resource baseline for the running deployment.

The critical leap came in synthesis. No single agent could have proven the most important findings alone. Inventory alone could see that `Holy` had one unit left. Fraud alone could see that cards were expired. Operations alone could see that `/orders` was the slowest and most brittle flow. But once the outputs were correlated, the platform told a deeper story: the premium product was unpurchasable, the payment service was acting as an amount threshold rather than a real validator, the only meaningful customer looked like a synthetic or automated actor, and the same unauthenticated data exposure that powered fast analysis was also the system's biggest breach surface.

## The Key Demo Moments

### 1. The Holy Sock Paradox

This is the flagship cross-domain insight. The catalogue says `Holy` exists, costs `$99.99`, and still has `1` unit in stock. The order and inventory work confirmed a flat `$4.99` shipping charge. The live payment service declines totals above `$100.00`. Put those together and a single-item Holy checkout totals `$104.98`, which means the product is real, visible, in stock, and mathematically impossible to purchase. The live anomaly demo confirmed it end to end with a real checkout attempt that returned `406 Not Acceptable` and the message `Payment declined: amount exceeds 100.00`.

### 2. Expired Cards Still Processing

By the start of Phase 3, all four stored cards in the live environment were expired, and two were malformed. That should have stopped commerce. Instead, the order history showed 66 successful orders before the live demo, all on `user`'s expired `08/19` card. The live demo then added five more approved orders, taking the visible order count from `66` to `71`. The combined evidence is hard to escape: the payment service enforces amount thresholds, not card authenticity. In other words, expired cards still clear as long as the basket total is low enough.

### 3. Single Customer Revenue Risk

Order intelligence and customer profiling both converged on the same result: one account, `user`, generated 100% of visible revenue. Before the live demo, that meant 66 orders and `$1491.01` in spend. No other visible customer had any order history. That is a business concentration problem, but it is also a signal-quality problem. If the only active customer disappears, visible revenue goes to zero. If the only active customer is synthetic, the revenue model was never real to begin with.

### 4. The Open API Paradox

The same openness that allowed AgentFlow to reason so quickly about Sock Shop is the application's biggest security defect. Customer, card, and address collections were publicly readable. The fraud and customer agents used those endpoints to produce live intelligence, but an attacker could have done the same thing for exfiltration. This is the paradox at the center of the demo: the tool that finds the problem succeeds for the same reason the application is vulnerable. AgentFlow's effectiveness here is real, but it also shows why production intelligence layers need governed read paths, masked data, and service-level access control.

### 5. Real-Time Fraud Detection

The live anomaly demo turned analysis into action. AgentFlow created a normal single-item order for `$12.98`, then a five-item near-threshold basket for `$84.31`, then the failed Holy checkout, then three rapid-fire Nerd leg orders inside the same second with gaps of `0.283s` and `0.166s`. That sequence reproduced velocity anomalies in real time and uncovered an extra defect: checkout did not clear the cart, so repeated order attempts accumulated quantity from `1` to `3` and raised totals from `$12.98` to `$28.96`. By the end of the run, order history had grown from `66` to `71` with zero code changes to the target application.

## The Punchline

By the time this narrative lands, the Sock Shop project has executed 9 sprints and 49 AgentFlow tasks. Before this finale, it had already produced 23 reports across the three phases of work; this document is the capstone that turns those reports into one story. Across the effort, AgentFlow analyzed more than 620 source and deployment files, documented 52 routes, mapped 16 HTTP dependencies plus RabbitMQ, observed 14 running containers, and carried five specialist intelligence agents through a full live demonstration.

And the most important numbers are the zeros. Lines of Sock Shop code changed: zero. APIs added: zero. Infrastructure modified: zero. AgentFlow did not need to be embedded inside the application to make the application intelligible. It used the interfaces that already existed and built a cognitive layer alongside the platform instead of inside it.

## Closing: What This Means

That is the broader point of the demo. Any organization with an existing application and accessible APIs can point AgentFlow at it and let it investigate. First it learns the shape of the system. Then it verifies that understanding against live behavior. Then it synthesizes what it finds into business, security, operational, and customer intelligence that would normally remain fragmented across teams and tools.

Sock Shop is just the proof case. The same pattern works anywhere there is enough surface area to observe: order intelligence from transaction history, fraud detection from behavior and validation gaps, inventory forecasting from catalogue and payment rules, customer-service reasoning from existing profile and order data, and operational judgment from live latency and health signals. The cognitive layer runs beside the application, not inside it.

This is what AI-powered application intelligence looks like when it is attached to real software instead of a greenfield prototype. AgentFlow did not ask the system to become AI-native. It met the system where it already was, learned it, tested it, and turned it into a platform that can explain itself.
