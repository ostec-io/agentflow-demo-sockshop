# Sock Shop — Live Health & Response Time Baseline

> Live measurements taken against `http://localhost:8888` on 2026-03-16.

---

## 1. Health Status Matrix

| Service | Container Status | Health Endpoint | Data Endpoint | Status |
|---------|-----------------|-----------------|---------------|--------|
| **edge-router** | Up ~1 hour | N/A (proxy) | N/A | **UP** |
| **front-end** | Up ~1 hour | N/A (Node.js) | Serves all routes | **UP** |
| **catalogue** | Up ~1 hour | `/catalogue/health` → 500 (`Do: not found`) | `/catalogue` → 200 (returns items) | **DEGRADED** — DB health check fails but data is served |
| **carts** | Up ~1 hour | `/carts/health` → 404 (not proxied) | `/cart` → 200 (returns `[]`) | **UP** — health endpoint not exposed through gateway |
| **orders** | Up ~1 hour | `/orders/health` → 200 (empty body) | `/orders` → 200 (auth required) | **UP** |
| **payment** | Up ~1 hour | `/payment/health` → 404 (not proxied) | N/A (internal only) | **UP** — container running, not directly accessible |
| **shipping** | Up ~1 hour | `/shipping/health` → 404 (not proxied) | N/A (internal only) | **UP** — container running, not directly accessible |
| **user** | Up ~1 hour | N/A | `/customers` → 200 (returns users) | **UP** |
| **catalogue-db** | Up ~1 hour | N/A | Internal (MySQL 3306) | **UP** |
| **carts-db** | Up ~1 hour | N/A | Internal (MongoDB 27017) | **UP** |
| **orders-db** | Up ~1 hour | N/A | Internal (MongoDB 27017) | **UP** |
| **user-db** | Up ~1 hour | N/A | Internal (MongoDB 27017) | **UP** |
| **rabbitmq** | Up ~1 hour | N/A | Internal (5672) | **UP** |
| **queue-master** | Up ~1 hour | N/A | N/A | **UP** |

**Summary:** 14/14 containers running. Catalogue health endpoint reports DB error (`Do: not found`) but continues serving cached/stale data. Health endpoints for carts, payment, and shipping are not routed through the edge-router proxy — they exist on the services but are inaccessible externally.

---

## 2. Response Time Table

### Raw Measurements (seconds)

| Run | `/catalogue` | `/customers` | `/orders` |
|-----|-------------|-------------|-----------|
| 1 | 0.01689 | 0.00833 | 0.04389 |
| 2 | 0.00696 | 0.00554 | 0.05014 |
| 3 | 0.00646 | 0.00954 | 0.00784 |
| 4 | 0.00661 | 0.00555 | 0.04867 |
| 5 | 0.00760 | 0.00610 | 0.04519 |

### Aggregate Statistics (seconds)

| Endpoint | Min | Max | Avg | P50 | Spread |
|----------|-----|-----|-----|-----|--------|
| `/catalogue` | 0.006 | 0.017 | **0.009** | 0.007 | 2.6x |
| `/customers` | 0.006 | 0.010 | **0.007** | 0.006 | 1.7x |
| `/orders` | 0.008 | 0.050 | **0.039** | 0.045 | 6.4x |

**Key Observations:**
- **Catalogue** and **customers** respond in under 10ms on average — very fast for local Docker networking.
- **Orders** averages ~39ms with high variance (6.4x spread between min/max). Run 3 was an outlier at 7.8ms; other runs clustered around 45-50ms. This confirms the synthesis prediction that orders has higher latency due to multi-service chaining.
- The first catalogue request (16.9ms) was ~2.5x slower than subsequent requests, suggesting JIT/connection warm-up effects in the Go service.

---

## 3. Concurrency Degradation

### Single Request vs 10 Concurrent Requests to `/catalogue`

| Metric | Single | 10 Concurrent |
|--------|--------|---------------|
| **Baseline** | 0.012s | — |
| **Fastest** | — | 0.023s |
| **Slowest** | — | 0.050s |
| **Average** | 0.012s | 0.039s |
| **Degradation** | — | **3.2x slower** |

### Individual Concurrent Request Times (seconds)

```
0.023  0.024  0.035  0.035  0.038  0.042  0.042  0.047  0.047  0.050
```

**Analysis:**
- Under 10 concurrent requests, average response time degrades from 12ms → 39ms (3.2x).
- The slowest concurrent request (50ms) is 4.2x slower than the single-request baseline.
- Response times show a roughly linear increase across concurrent requests, suggesting sequential queuing rather than true parallelism — consistent with the synthesis finding that catalogue uses in-memory pagination and has no connection pooling optimization.
- Even under concurrency, all responses complete within 50ms — acceptable for a local environment with low absolute load.

---

## 4. Resource Consumption

### Container CPU & Memory Usage (Idle/Light Load)

| Container | CPU % | Memory Usage | Memory Limit | Notes |
|-----------|-------|-------------|-------------|-------|
| **queue-master** | 0.29% | **799.1 MiB** | 7.65 GiB | Highest memory — JVM-based |
| **orders** | 0.20% | **568.1 MiB** | 7.65 GiB | JVM-based (Spring Boot) |
| **shipping** | 0.25% | **475.7 MiB** | 7.65 GiB | JVM-based (Spring Boot) |
| **carts** | 0.36% | **455.5 MiB** | 7.65 GiB | JVM-based (Spring Boot) |
| **front-end** | 1.17% | **294.7 MiB** | 7.65 GiB | Node.js — highest CPU |
| **user-db** | 1.87% | **244.6 MiB** | 7.65 GiB | MongoDB — highest CPU overall |
| **catalogue-db** | 0.18% | **236.8 MiB** | 7.65 GiB | MySQL |
| **rabbitmq** | 0.39% | **112.0 MiB** | 7.65 GiB | Message broker |
| **carts-db** | 0.39% | **64.6 MiB** | 7.65 GiB | MongoDB |
| **edge-router** | 0.25% | **54.3 MiB** | 7.65 GiB | Nginx proxy |
| **orders-db** | 0.40% | **44.5 MiB** | 7.65 GiB | MongoDB |
| **user** | 0.65% | **35.5 MiB** | 7.65 GiB | Go service — lightweight |
| **catalogue** | 0.13% | **18.0 MiB** | 7.65 GiB | Go service — lightest |
| **payment** | 0.00% | **13.9 MiB** | 7.65 GiB | Go service — near-zero CPU |

### Total Footprint

| Metric | Value |
|--------|-------|
| **Total Memory (all Sock Shop containers)** | ~3.4 GiB |
| **JVM services (orders, shipping, carts, queue-master)** | ~2.3 GiB (68% of total) |
| **Go services (catalogue, user, payment)** | ~67 MiB (2% of total) |
| **Databases** | ~590 MiB (17%) |
| **Infrastructure (edge-router, rabbitmq, front-end)** | ~461 MiB (13%) |

**Key Observations:**
- **JVM services dominate memory** at 2.3 GiB for 4 services, vs 67 MiB for 3 Go services — a 34x difference per service.
- **queue-master** is the heaviest single container at 799 MiB for a single-threaded message consumer.
- **No memory limits are configured** — all containers share the 7.65 GiB host limit. A memory leak in any JVM service could starve others.
- **CPU is negligible** at idle — user-db (1.87%) and front-end (1.17%) are the highest consumers.

---

## 5. Phase 1 Synthesis Comparison

| Prediction (synthesis-performance.md) | Live Measurement | Validated? |
|---------------------------------------|-----------------|------------|
| Orders chains 4+ synchronous calls → higher latency | Orders avg 39ms vs catalogue 9ms (4.3x slower) | **YES** |
| Payment is trivial, sub-millisecond logic | Payment uses 0.00% CPU, 13.9 MiB RAM — lightest service | **YES** |
| No caching anywhere → every request hits DB | Catalogue health reports DB error but data still serves (suggests some in-memory state) | **PARTIAL** — Go service may cache in-process |
| Front-end has no timeouts | front-end highest CPU (1.17%) even at idle — consistent with persistent connections | **CONSISTENT** |
| queue-master is single-threaded | 799 MiB for a single consumer — JVM overhead confirmed | **YES** |
| No Docker health checks configured | All containers show basic "Up" status, no "(healthy)" annotation | **YES** |
| All services are single replicas | `docker ps` confirms 1 instance per service | **YES** |
| Catalogue in-memory pagination → performance degrades under concurrency | 3.2x degradation at 10 concurrent requests | **YES** |

### Anomalies Not Predicted

1. **Catalogue health endpoint failure** — `/catalogue/health` returns 500 with `Do: not found`, suggesting the catalogue-db health probe is failing even though data queries succeed. This may indicate a missing health-check table or a misconfigured DB connection string for the health path.
2. **Orders health returns empty body** — The `/orders/health` endpoint returns HTTP 200 but with no body content, making automated health monitoring unreliable.
3. **Health endpoints not routed** — The edge-router (Nginx) does not proxy `/carts/health`, `/payment/health`, or `/shipping/health` to their respective services. These endpoints are only accessible on the internal Docker network.

---

## 6. Recommendations

1. **Fix catalogue health endpoint** — Investigate the `Do: not found` error; likely a missing or misconfigured DB health query.
2. **Expose all health endpoints** — Update edge-router Nginx config to proxy `/*/health` to each backend service.
3. **Add Docker health checks** — Configure `HEALTHCHECK` in compose to enable automatic container restart on health failure.
4. **Set container memory limits** — JVM services should have explicit `-Xmx` and Docker `mem_limit` to prevent resource starvation.
5. **Monitor orders latency** — 39ms average with 6.4x variance warrants investigation into which downstream call introduces the variability.
