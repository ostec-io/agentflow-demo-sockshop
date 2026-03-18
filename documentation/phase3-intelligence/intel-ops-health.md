# Sock Shop Operational Health Assessment

Generated: 2026-03-17  
Target: `http://localhost:8888`  
Sprint: `Sock Shop Phase 3 Sprint 1: Cognitive Intelligence Gathering`

## Scope

This report establishes a live operational baseline for the Sock Shop deployment by:

- probing public, authenticated, and health endpoints three times each
- measuring concurrent request behaviour under 10-way fan-out
- inspecting live container resource consumption
- validating error handling for expected failure modes
- comparing live observations with the Phase 1 static analysis in `documentation/synthesis-performance.md`

## Method

- Authentication uses the demo credentials provided for this task.
- API probes are executed with `curl` against the edge endpoint on port `8888`.
- Infrastructure metrics are collected from the local Docker runtime with `docker stats` and `docker ps`.
- Sections are appended incrementally as measurements are completed.

## 1. Service Health Matrix

| Service | Endpoint | HTTP Status | Avg Response Time | Latency Class | Status |
| --- | --- | --- | --- | --- | --- |
| Catalogue | `/catalogue` | `200` | 13.1 ms | FAST | UP |
| Catalogue | `/catalogue/size` | `200` | 49.7 ms | FAST | UP |
| Catalogue | `/tags` | `200` | 51.7 ms | NORMAL | UP |
| User | `/customers` | `200` | 11.8 ms | FAST | UP |
| User | `/cards` | `200` | 52.6 ms | NORMAL | UP |
| User | `/addresses` | `200` | 51.8 ms | NORMAL | UP |
| Orders | `/orders` | `201` | 205.8 ms | SLOW | DEGRADED |
| Carts | `/cart` | `200` | 84.4 ms | NORMAL | UP |
| Catalogue | `/catalogue/health` | `200` | 50.9 ms | NORMAL | UP |
| Orders | `/orders/health` | `404` | 33.0 ms | FAST | DOWN |
| Carts | `/carts/health` | `404` | 30.5 ms | FAST | DOWN |
| Payment | `/payment/health` | `404` | 56.0 ms | NORMAL | DOWN |
| Shipping | `/shipping/health` | `404` | 50.8 ms | NORMAL | DOWN |

Observations:

- The business endpoints are broadly available, but `GET /orders` returns `201 Created` rather than the expected `200 OK`, which is an API contract anomaly.
- Four of the five service health routes exposed through the edge return `404`, so health visibility at the ingress layer is incomplete even though some corresponding business endpoints remain functional.

## 2. Performance Baseline

### Single-Request Runs

| Endpoint | Run 1 | Run 2 | Run 3 | Avg | Min | Max | Variance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/catalogue` | 20.4 ms | 5.9 ms | 12.9 ms | 13.1 ms | 5.9 ms | 20.4 ms | 34.81 ms^2 |
| `/catalogue/size` | 47.3 ms | 54.7 ms | 47.1 ms | 49.7 ms | 47.1 ms | 54.7 ms | 12.70 ms^2 |
| `/tags` | 48.6 ms | 52.6 ms | 53.8 ms | 51.7 ms | 48.6 ms | 53.8 ms | 5.06 ms^2 |
| `/customers` | 15.6 ms | 10.5 ms | 9.2 ms | 11.8 ms | 9.2 ms | 15.6 ms | 7.58 ms^2 |
| `/cards` | 50.3 ms | 51.6 ms | 55.9 ms | 52.6 ms | 50.3 ms | 55.9 ms | 5.62 ms^2 |
| `/addresses` | 56.4 ms | 48.7 ms | 50.4 ms | 51.8 ms | 48.7 ms | 56.4 ms | 11.00 ms^2 |
| `/orders` | 406.9 ms | 114.9 ms | 95.7 ms | 205.8 ms | 95.7 ms | 406.9 ms | 20282.84 ms^2 |
| `/cart` | 147.7 ms | 51.1 ms | 54.4 ms | 84.4 ms | 51.1 ms | 147.7 ms | 2005.88 ms^2 |
| `/catalogue/health` | 53.1 ms | 50.3 ms | 49.3 ms | 50.9 ms | 49.3 ms | 53.1 ms | 2.60 ms^2 |
| `/orders/health` | 70.6 ms | 13.7 ms | 14.7 ms | 33.0 ms | 13.7 ms | 70.6 ms | 706.11 ms^2 |
| `/carts/health` | 4.9 ms | 43.6 ms | 43.0 ms | 30.5 ms | 4.9 ms | 43.6 ms | 329.00 ms^2 |
| `/payment/health` | 44.8 ms | 51.6 ms | 71.8 ms | 56.0 ms | 44.8 ms | 71.8 ms | 131.29 ms^2 |
| `/shipping/health` | 49.3 ms | 48.1 ms | 54.9 ms | 50.8 ms | 48.1 ms | 54.9 ms | 8.66 ms^2 |

### 10-Concurrent Runs

| Endpoint | Sample 1 | Sample 2 | Sample 3 | Avg (10 req) | Min | Max | Variance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/catalogue` | 63.4 ms | 76.3 ms | 80.1 ms | 79.4 ms | 63.4 ms | 84.6 ms | 33.95 ms^2 |
| `/customers` | 33.4 ms | 41.7 ms | 43.1 ms | 40.5 ms | 33.4 ms | 43.1 ms | 7.32 ms^2 |
| `/orders` | 720.0 ms | 787.7 ms | 792.6 ms | 788.9 ms | 720.0 ms | 806.4 ms | 567.14 ms^2 |

## 3. Concurrency Degradation Analysis

| Endpoint | Single Avg | 10-Concurrent Avg | Degradation Factor | Flag |
| --- | --- | --- | --- | --- |
| `/catalogue` | 13.1 ms | 79.4 ms | 6.07x | FLAG |
| `/customers` | 11.8 ms | 40.5 ms | 3.43x | FLAG |
| `/orders` | 205.8 ms | 788.9 ms | 3.83x | FLAG |

Findings:

- All three sampled endpoints degrade by more than `3x` under only 10 concurrent requests.
- `/catalogue` remains absolutely fast but shows the largest relative slowdown, suggesting low headroom or shared contention at the edge/database layer.
- `/orders` is the clearest operational bottleneck: it is the slowest single request path and remains near `0.8s` average under modest concurrency.

## 4. Infrastructure Resource Report

Docker status summary:

- All Sock Shop containers are `Up` and have been running for roughly `25 hours`.
- No container reports a Docker-level `unhealthy` state, but the compose output does not expose active health checks for the application services.
- Two non-Sock-Shop containers are present on the same host: `nginx-sdk-test.1.zhb4xt3lrxf61jmicow2dzlyr` and `pentest-target`.

### Resource Snapshot

| Container | CPU | Memory Usage | Memory % | Threshold Flag |
| --- | --- | --- | --- | --- |
| `docker-compose-edge-router-1` | 0.02% | 345.4MiB | 4.41% | OK |
| `docker-compose-catalogue-db-1` | 0.15% | 429.4MiB | 5.48% | OK |
| `docker-compose-orders-db-1` | 0.44% | 27.31MiB | 0.35% | OK |
| `docker-compose-carts-db-1` | 0.99% | 35.1MiB | 0.45% | OK |
| `docker-compose-carts-1` | 0.22% | 422.4MiB | 5.39% | OK |
| `docker-compose-catalogue-1` | 0.00% | 71.79MiB | 0.92% | OK |
| `docker-compose-user-1` | 0.00% | 205.6MiB | 2.62% | OK |
| `docker-compose-shipping-1` | 0.92% | 348.1MiB | 4.44% | OK |
| `docker-compose-front-end-1` | 0.00% | 191.6MiB | 2.44% | OK |
| `docker-compose-orders-1` | 0.24% | 586.8MiB | 7.49% | OK |
| `docker-compose-payment-1` | 0.00% | 42.51MiB | 0.54% | OK |
| `docker-compose-user-db-1` | 1.29% | 3.052GiB | 39.87% | OK |
| `docker-compose-queue-master-1` | 0.31% | 473.2MiB | 6.04% | OK |
| `docker-compose-rabbitmq-1` | 1.64% | 89.36MiB | 1.14% | OK |

Totals:

- Sock Shop containers: `6.24 GiB` resident memory and `6.22%` aggregate CPU at sample time.
- All running containers on host: `6.38 GiB` resident memory and `8.30%` aggregate CPU.
- No Sock Shop container crossed the alert thresholds of `>50%` memory or `>25%` CPU.

Assessment:

- Resource efficiency is acceptable at idle-to-light load.
- `user-db` is the dominant memory consumer at `3.052 GiB`, about `49%` of the Sock Shop container memory footprint, and should be tracked as the most likely capacity pressure point.
- `orders` is the heaviest application-service process in memory at `586.8 MiB`, followed by `queue-master` at `473.2 MiB`.

## 5. Error Handling Assessment

### Probe Results

| Scenario | Endpoint | Observed Response | Assessment |
| --- | --- | --- | --- |
| Unauthenticated access | `/orders` | `500` with `{\"message\":\"User not logged in.\",\"error\":{}}` | Fails closed, but uses the wrong status code. Expected `401` or `403`. |
| Unauthenticated access | `/cart` | `200` with `[]` | Auth is not enforced consistently; empty success response masks authorization failure. |
| Non-existent resource | `/catalogue/nonexistent-id` | `200` with `{\"error\":\"Do: not found\",\"status_code\":500,\"status_text\":\"Internal Server Error\"}` | Incorrect success status plus internal error leakage. |
| Non-existent resource | `/orders/nonexistent-id` | `404` with empty body | Correct status, but sparse contract compared with other services. |
| Invalid operation | `POST /orders` without auth | `500` with `{\"message\":\"User not logged in.\",\"error\":{}}` | Same auth problem as `GET /orders`; request is rejected but status semantics are wrong. |

### Assessment

- Unauthenticated requests are not handled consistently across services. `orders` rejects them, but `cart` returns a valid `200` payload.
- Missing-resource handling is also inconsistent. `orders` returns a proper `404`, while `catalogue` returns `200` and embeds a backend `500` description in the body.
- Error payload shapes differ materially across endpoints, which makes client-side handling and monitoring brittle.
- The catalogue missing-item response leaks internal implementation detail through `status_code` and `status_text`, which is both noisy operationally and poor error hygiene.

## 6. Operational Health Scorecard

| Dimension | Score | Rationale |
| --- | --- | --- |
| Availability | 7/10 | Core business endpoints are reachable, but four service health routes return `404` at the edge and the orders endpoint uses an anomalous success code. |
| Performance | 6/10 | Most read endpoints are under `100 ms`, but `/orders` averages `205.8 ms` with very high variance and is the slowest path by a wide margin. |
| Resilience | 4/10 | All sampled endpoints degrade by more than `3x` under only 10 concurrent requests, with `/catalogue` worsening by `6.07x`. |
| Error handling | 2/10 | Auth handling, missing-resource semantics, and error payloads are inconsistent; one catalogue miss returns `200` while exposing an internal `500`. |
| Resource efficiency | 8/10 | CPU is low and no container breaches the requested thresholds, though `user-db` is materially heavier than the rest of the stack. |

Overall health: **AMBER**

Key findings:

- The stack is operational for normal demo traffic.
- The orders path is the primary performance bottleneck in live measurements.
- Health observability through the edge is incomplete.
- Error handling quality is poor enough to create operational ambiguity during incidents.

## 7. Comparison with Phase 1 Predictions

Phase 1 reference: `documentation/synthesis-performance.md`

### Confirmed by Live Measurements

- The predicted order-path bottleneck is confirmed. `/orders` is the slowest endpoint in the baseline and degrades to `788.9 ms` average under 10-way concurrency.
- The general resilience concern is confirmed. Even lightweight endpoints degrade by more than `3x` under modest concurrent load.
- The catalogue path shows the kind of contention sensitivity Phase 1 anticipated, even though its absolute latency remains low at this dataset size.

### Partially Confirmed or Not Fully Exercised

- The predicted catalogue in-memory pagination issue is not yet catastrophic in the live baseline, likely because the current dataset is small. The `6.07x` concurrency slowdown suggests it remains a real scaling risk.
- Predicted front-end timeout weaknesses, RabbitMQ durability risks, and deeper inter-service retry/circuit-breaker gaps were not directly triggered by these edge-only probes, so they remain open architectural risks rather than measured failures in this run.
- The user-service pagination concern was not surfaced by latency alone; `/customers`, `/cards`, and `/addresses` remain fast in this baseline.

### Surprises Not Predicted by Static Analysis

- Health endpoints are not consistently exposed through the ingress layer. `orders`, `carts`, `payment`, and `shipping` health routes all returned `404`.
- `GET /orders` returns `201 Created`, which indicates a contract defect or status rewrite issue unrelated to the Phase 1 performance model.
- Catalogue missing-resource handling is significantly worse than expected: it returns `200` while embedding a backend `500` payload.
- `user-db` consumes `3.052 GiB`, making it the dominant memory user despite user-facing reads being fast.

## 8. Baseline Conclusion

Sock Shop is currently usable and lightly loaded, but the operational baseline is weaker than the raw uptime suggests. The platform's biggest immediate weaknesses are:

- degraded order-path latency
- sharp latency amplification under small concurrent bursts
- incomplete ingress-level health visibility
- inconsistent and sometimes misleading error semantics

The most practical next actions are to fix health-route exposure, normalize API status codes, and investigate the orders path before traffic is increased.
