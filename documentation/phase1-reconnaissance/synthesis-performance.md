# Sock Shop — Performance & Reliability Analysis

> Cross-service synthesis from per-service analysis profiles. Generated 2026-03-16.

---

## Executive Summary

**Resilience Rating: FRAGILE**

The Sock Shop has no resilience patterns beyond basic circuit breakers on the Go services. The order creation flow chains 4+ synchronous service calls with no retries, timeouts are generous (5s per call), there's no caching anywhere, databases have no connection limits, the RabbitMQ queue is non-durable, and every component is a single instance with no replicas. The system will fail ungracefully under moderate load.

---

## Bottleneck Inventory (Ranked by Impact)

### 1. Order Creation — Sequential Multi-Service Chain (Impact: CRITICAL)
- **Service:** orders
- **Evidence:** `OrdersController` dispatches 4 parallel fetches (user×3, carts), then sequential payment + shipping calls. Each `Future.get()` has a 5s timeout. Worst case: ~25s per order.
- **Root Cause:** While initial fetches are parallel, payment and shipping are sequential by design. No circuit breaker on the orders service itself — if payment is slow, orders blocks.
- **Recommendation:** Add circuit breakers on outbound calls. Consider async order processing (accept order, process in background).

### 2. Catalogue — In-Memory Pagination (Impact: HIGH)
- **Service:** catalogue
- **File:** `catalogue/service.go:90`
- **Evidence:** `List()` performs a 3-table JOIN, fetches ALL matching rows into Go memory, then paginates via `cut()` function. Pagination does not reduce database load.
- **Recommendation:** Push pagination to SQL with `LIMIT/OFFSET`. Add response caching (catalogue data is near-static).

### 3. No Caching Anywhere (Impact: HIGH)
- **Services:** ALL
- **Evidence:** Every request hits the database. Catalogue data (rarely changes), tag lists, user profiles — all fetched fresh every time. No HTTP cache headers, no in-memory cache, no Redis cache layer.
- **Recommendation:** Add caching for catalogue (TTL-based), tags (long-lived), user profiles (short-lived).

### 4. Front-End — No Request Timeouts (Impact: HIGH)
- **Service:** front-end
- **File:** `front-end/api/*/index.js`
- **Evidence:** All backend HTTP calls via `request` library have no timeout configured. A hung backend will hold the client connection indefinitely, eventually exhausting Node.js connection pool.
- **Recommendation:** Set `timeout` on all `request()` calls (e.g., 10s).

### 5. RabbitMQ — Non-Durable Queue, No Dead Letter (Impact: HIGH)
- **Service:** shipping, queue-master
- **Evidence:** Queue `shipping-task` is `durable=false`. Broker restart loses all pending messages. No dead-letter exchange — poison messages cause infinite requeue loops.
- **Recommendation:** Set `durable=true`, configure DLX/DLQ, add message TTL.

### 6. Carts — N+1 Query Pattern (Impact: MEDIUM)
- **Service:** carts
- **Evidence:** Items use `@DBRef` — each cart read triggers additional MongoDB queries to resolve item references. Cart with 10 items = 11 queries.
- **Recommendation:** Embed items in the cart document instead of using `@DBRef`.

### 7. User — No Pagination on List Endpoints (Impact: MEDIUM)
- **Service:** user
- **File:** `user/db/mongodb/mongodb.go`
- **Evidence:** `GetUsers()`, `GetCards()`, `GetAddresses()` all use `Find(nil).All()` — loads entire collection into memory. Code contains `// TODO: add pagination`.
- **Recommendation:** Implement cursor-based pagination.

### 8. RestTemplate — No Connection Pooling (Impact: MEDIUM)
- **Service:** orders
- **Evidence:** `RestTemplate` uses default `SimpleClientHttpRequestFactory` — no connection pooling. Each outbound call opens a new TCP connection. Under load, this exhausts ports and increases latency.
- **Recommendation:** Switch to `HttpComponentsClientHttpRequestFactory` with Apache HttpClient for connection pooling.

---

## Single Points of Failure

| Component | Failure Impact | Replicas | Mitigation Present |
|-----------|---------------|----------|-------------------|
| edge-router | **Complete outage** — only ingress point | 1 | `restart: always` only |
| front-end | **Complete outage** — all user traffic | 1 | `restart: always` |
| orders | **Cannot place orders** | 1 | `restart: always` |
| payment | **Orders fail at payment step** (406 to client) | 1 | `restart: always` |
| catalogue | **Cannot browse products** | 1 | Circuit breaker (30s) |
| user | **Cannot login, register, or place orders** | 1 | `restart: always` |
| carts | **Cannot manage cart** | 1 | `restart: always` |
| shipping | **Orders succeed but shipment silently lost** | 1 | Swallows errors! |
| queue-master | **Shipping tasks queue up in RabbitMQ** | 1 | Single consumer thread |
| rabbitmq | **Shipping pipeline halts, pending messages lost** (non-durable) | 1 | None |
| catalogue-db | **Catalogue unavailable** | 1 | Health check in catalogue service |
| carts-db | **Cart unavailable** | 1 | None |
| orders-db | **Orders unavailable** | 1 | None |
| user-db | **Auth and user management unavailable** | 1 | None |
| session-db (Redis) | **All sessions lost, users logged out** | 1 | Falls back to in-memory (worse) |

**All data stores use ephemeral container storage** — a `docker-compose down` destroys all data permanently.

---

## Missing Resilience Patterns

| Pattern | Where Needed | Current State |
|---------|-------------|---------------|
| **Circuit Breaker** | orders→payment, orders→shipping, front-end→all backends | Only catalogue and payment (Go services) have circuit breakers. Orders and front-end have none. |
| **Retry with Backoff** | All inter-service calls | None anywhere. Single attempt, fail immediately. |
| **Timeout** | front-end→backends | No timeouts on `request` library calls. Orders has 5s `Future.get()` timeout. |
| **Bulkhead** | orders (isolate payment from shipping) | None. A slow payment call blocks the entire order thread. |
| **Rate Limiting** | front-end (gateway) | None. No protection against abuse or DDoS. |
| **Health Check** | Docker Compose | Not configured in compose. Services have `/health` endpoints but Docker doesn't check them. |
| **Graceful Degradation** | catalogue (serve stale data on DB failure) | None. DB failure = service failure. |
| **Dead Letter Queue** | RabbitMQ shipping pipeline | Not configured. Poison messages loop forever. |
| **Persistent Queue** | RabbitMQ | Queue is non-durable. Broker restart = message loss. |
| **Connection Pooling** | orders→backends (RestTemplate) | Uses SimpleClientHttpRequestFactory (no pooling). |

---

## Scalability Assessment

| Service | Stateless? | Horizontally Scalable? | Bottleneck |
|---------|-----------|----------------------|------------|
| front-end | No (in-memory sessions by default) | With Redis sessions: Yes | No connection pooling, no timeouts |
| catalogue | Yes | Yes | In-memory pagination, no caching, unbounded MySQL connections |
| carts | Yes | Yes | N+1 MongoDB queries via @DBRef |
| orders | Yes | Yes | Sequential payment→shipping, no connection pooling on RestTemplate |
| user | Yes | Yes | No pagination on list endpoints, entire collection loaded to memory |
| payment | Yes | Yes (trivially) | None — pure in-memory logic, sub-millisecond |
| shipping | Yes | Yes | Silent failure on RabbitMQ errors |
| queue-master | Yes | Yes (with competing consumers) | Single consumer thread, single-threaded processing |
| RabbitMQ | N/A | Not configured for clustering | Single instance, non-durable queue, no HA |
| Databases | N/A | Not configured for replication | Single instances, no persistent volumes |

---

## Load Profile Estimation

### At 10x Traffic (~2,000 req/min)
- **Catalogue:** In-memory pagination starts consuming significant RAM. MySQL connections may exhaust (unlimited by default).
- **Front-end:** Node.js event loop may block on synchronous waterfall patterns. `request` library without timeouts will leak connections to slow backends.
- **Orders:** RestTemplate TCP connection exhaustion (no pooling). Each order opens 6+ new connections.
- **Impact:** Degraded performance, increasing latency, some timeouts.

### At 100x Traffic (~20,000 req/min)
- **Catalogue:** OOM on large catalogue with full result-set pagination. MySQL connection storm.
- **User:** `GetUsers().All()` loads entire customer collection per list request — OOM.
- **Carts:** N+1 queries create MongoDB connection pressure.
- **RabbitMQ:** Queue depth grows if queue-master (single-threaded) can't keep up. Memory pressure on broker.
- **Impact:** Service failures, cascading timeouts, potential data loss via shipping silent failures.

### At 1000x Traffic (~200,000 req/min)
- **Everything breaks.** No service is designed for this scale.
- **Critical failures:** MongoDB connection exhaustion across all services, Node.js event loop saturation, RabbitMQ memory overflow, MySQL connection limit exceeded.
- **Data loss:** Non-durable RabbitMQ queue, silent shipping failures, no persistent volumes.

---

## Recommended Improvements (Prioritised)

| Priority | Improvement | Effort | Impact | Services |
|----------|------------|--------|--------|----------|
| 1 | Add request timeouts to front-end | Low | High | front-end |
| 2 | Push catalogue pagination to SQL | Low | High | catalogue |
| 3 | Add caching for catalogue/tags | Low | High | catalogue, front-end |
| 4 | Make RabbitMQ queue durable + add DLQ | Low | High | shipping, queue-master |
| 5 | Add circuit breakers to orders service | Medium | High | orders |
| 6 | Switch RestTemplate to pooled HTTP client | Medium | Medium | orders |
| 7 | Embed cart items instead of @DBRef | Medium | Medium | carts |
| 8 | Add pagination to user list endpoints | Low | Medium | user |
| 9 | Configure Docker health checks | Low | Medium | infrastructure |
| 10 | Add persistent volumes to databases | Low | High | infrastructure |
| 11 | Configure MongoDB/MySQL connection limits | Low | Medium | catalogue, carts, orders, user |
| 12 | Add concurrent consumers to queue-master | Low | Medium | queue-master |
| 13 | Add retry with backoff on inter-service calls | Medium | Medium | orders, front-end |
| 14 | Set up RabbitMQ clustering | High | High | infrastructure |
| 15 | Add rate limiting to front-end gateway | Medium | Medium | front-end |
