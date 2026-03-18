# Carts Service Profile

**Technology:** Java / Spring Boot
**Database:** MongoDB (`carts-db`)
**Default Port:** 8081
**Spring Application Name:** `carts`

---

## 1. Endpoints

### CartsController — `/carts`

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `GET` | `/carts/{customerId}` | 200 OK | Returns the cart for the given customer. Response: `Cart` JSON. |
| `DELETE` | `/carts/{customerId}` | 202 Accepted | Deletes the cart for the given customer. No response body. |
| `GET` | `/carts/{customerId}/merge?sessionId={sessionId}` | 202 Accepted | Merges the anonymous session cart into the customer's cart, then deletes the session cart. No response body. |

### ItemsController — `/carts/{customerId}/items`

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `GET` | `/carts/{customerId}/items` | 200 OK | Lists all items in the customer's cart. Response: `Item[]` JSON. |
| `GET` | `/carts/{customerId}/items/{itemId}` | 200 OK | Returns a single item from the cart. Response: `Item` JSON. |
| `POST` | `/carts/{customerId}/items` | 201 Created | Adds an item to the cart. If the item already exists, increments quantity by 1. Request/Response: `Item` JSON. |
| `PATCH` | `/carts/{customerId}/items` | 202 Accepted | Updates (merges) an existing item in the cart. Request: `Item` JSON. No response body. |
| `DELETE` | `/carts/{customerId}/items/{itemId}` | 202 Accepted | Removes an item from the cart and deletes it from the item repository. No response body. |

### HealthCheckController

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| `GET` | `/health` | 200 OK | Returns health status of the app and its MongoDB connection. |

**Health response shape:**
```json
{
  "health": [
    { "service": "carts", "status": "OK", "date": "<timestamp>" },
    { "service": "carts-db", "status": "OK", "date": "<timestamp>" }
  ]
}
```
The `carts-db` status is set to `"err"` if the `buildInfo` command fails against MongoDB.

---

## 2. Data Model

### Cart (MongoDB Document)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` | MongoDB `@Id`, auto-generated. |
| `customerId` | `String` | `@NotNull`. Public field (no getter/setter). Used as the logical key in all API paths. |
| `items` | `List<Item>` | `@DBRef` — items are stored as references to the `Item` collection, not embedded. |

### Item (MongoDB Document)

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` | MongoDB `@Id`, auto-generated. |
| `itemId` | `String` | `@NotNull`. The catalogue/product identifier. Used for equality checks. |
| `quantity` | `int` | Defaults to `1`. |
| `unitPrice` | `float` | Defaults to `0`. |

Items are stored in their own collection and linked to carts via `@DBRef`. Equality is based solely on `itemId`.

---

## 3. Dependencies

### Datastore
- **MongoDB** at `mongodb://${db:carts-db}:27017/data` (env var `db`, default hostname `carts-db`).

### Outbound Service Calls
- **None.** The carts service is self-contained; it does not call any other Sock Shop microservices.

### Tracing (optional)
- **Spring Cloud Sleuth / Zipkin** — disabled by default (`spring.zipkin.enabled=false`). When enabled, sends traces to `http://${zipkin_host}:9411/` with 100% sampling.

---

## 4. Security

### Authentication & Authorization
- **None.** There are no auth checks, tokens, or middleware. All endpoints are publicly accessible.
- **No access-control isolation:** Any caller who knows a `customerId` can read, modify, or delete that customer's cart. User A can access User B's cart by supplying B's `customerId` in the URL path.

### Input Validation
- `@NotNull` on `Cart.customerId` and `Item.itemId` (JSR-303 annotations), but no `@Valid` annotation on controller method parameters — **these constraints are not enforced at the controller level**.
- `customerId` and `itemId` path variables use the regex `.*`, accepting any string including empty.
- No size/length limits on string inputs.
- No sanitisation of inputs before MongoDB operations (relies on Spring Data MongoDB parameterised queries).

### Summary of Risks
1. **No authentication** — any client on the network can manipulate any cart.
2. **No authorisation** — no ownership check between the authenticated user and the `customerId` in the URL.
3. **Unenforced validation** — `@NotNull` constraints exist on entities but are not triggered on inbound requests.

---

## 5. Performance & Configuration

### MongoDB Client Configuration
- **Server selection timeout:** 10,000 ms (10 seconds), configured via `MongoClientOptions` in `MongoConfiguration.java`.
- No explicit connection pool size, socket timeout, or read preference overrides — Spring Boot / Mongo driver defaults apply.
- Default Mongo driver connection pool: 100 connections (driver default).

### Caching
- **None.** Every request hits MongoDB directly.

### Actuator
- Default health endpoint is **disabled** (`endpoints.health.enabled=false`); the service provides its own `/health` endpoint.
- Metrics endpoint is **disabled** (`endpoints.metrics.enabled=false`); a Prometheus-compatible endpoint is mapped to `/metrics` via `endpoints.prometheus.id=metrics`.

### Item Storage Pattern
- Items use `@DBRef`, meaning each cart read triggers additional queries to resolve item references. This is an N+1 concern for carts with many items.
