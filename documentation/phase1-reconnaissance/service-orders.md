# Orders Service Profile

**Technology:** Java / Spring Boot
**Database:** MongoDB (`orders-db:27017`, database `data`)
**Default Port:** 8082
**Role:** Order orchestrator — coordinates User, Cart, Payment, and Shipping services during order creation.

---

## 1. Endpoints

### POST `/orders`

**Content-Type:** `application/json`
**Response Status:** `201 Created`
**Controller:** `OrdersController` (`@RepositoryRestController`)

#### Request Body (`NewOrderResource`)

| Field      | Type  | Validation  | Description                                      |
|------------|-------|-------------|--------------------------------------------------|
| `customer` | `URI` | `@URL`, required | URL to fetch customer data (e.g. `http://user/customers/{id}`) |
| `address`  | `URI` | `@URL`, required | URL to fetch address data (e.g. `http://user/addresses/{id}`) |
| `card`     | `URI` | `@URL`, required | URL to fetch card data (e.g. `http://user/cards/{id}`) |
| `items`    | `URI` | `@URL`, required | URL to fetch cart items (e.g. `http://carts/{id}/items`) |

All four fields must be non-null or the request is rejected with `406 Not Acceptable`.

#### Response Body (`CustomerOrder`)

```json
{
  "id": "string (MongoDB ObjectId)",
  "customerId": "string",
  "customer": { "id", "firstName", "lastName", "username", "addresses", "cards" },
  "address": { "id", "number", "street", "city", "postcode", "country" },
  "card": { "id", "longNum", "expires", "ccv" },
  "items": [{ "id", "itemId", "quantity", "unitPrice" }],
  "shipment": { "id", "name" },
  "date": "ISO timestamp",
  "total": "float"
}
```

#### Error Responses

| Status | Exception                  | Condition                              |
|--------|---------------------------|----------------------------------------|
| 406    | `InvalidOrderException`    | Missing `customer`, `address`, `card`, or `items` |
| 406    | `PaymentDeclinedException` | Payment not authorised or response null |
| 500    | `IllegalStateException`    | Timeout or IO error from downstream services |

### Spring Data REST Auto-Exposed Endpoints

Because `CustomerOrderRepository` extends a Spring Data repository and the controller uses `@RepositoryRestController`, Spring Data REST automatically exposes:

- **GET `/orders`** — list all orders (paginated, HATEOAS)
- **GET `/orders/{id}`** — get order by ID
- **GET `/orders/search/customerId?custId={custId}`** — find orders by customer ID

---

## 2. Data Model

### `CustomerOrder` (MongoDB `@Document`)

| Field        | Type                | Notes                          |
|--------------|---------------------|--------------------------------|
| `id`         | `String` (`@Id`)    | MongoDB-generated              |
| `customerId` | `String`            | Parsed from customer HATEOAS href |
| `customer`   | `Customer`          | Embedded snapshot              |
| `address`    | `Address`           | Embedded snapshot              |
| `card`       | `Card`              | Embedded snapshot              |
| `items`      | `Collection<Item>`  | Embedded snapshot              |
| `shipment`   | `Shipment`          | Embedded snapshot              |
| `date`       | `Date`              | Order creation timestamp       |
| `total`      | `float`             | Calculated total including shipping |

### `Customer`

Fields: `id`, `firstName`, `lastName`, `username`, `addresses` (List\<Address\>, `@DBRef` lazy), `cards` (List\<Card\>, `@DBRef` lazy).

### `Address`

Fields: `id`, `number`, `street`, `city`, `postcode`, `country`.

### `Card`

Fields: `id`, `longNum`, `expires`, `ccv`.

### `Item`

Fields: `id`, `itemId` (`@NotNull`), `quantity`, `unitPrice` (float).

### `Shipment`

Fields: `id` (UUID), `name` (customer ID used as name).

### Storage Note

The order document embeds full snapshots of customer, address, card, items, and shipment data — it does **not** store references. This means order data is immutable with respect to later changes in the User or Cart services.

---

## 3. Inter-Service Calls

### Order Creation Flow

```
Client POST /orders
  │
  ├─ [async] GET {item.customer}  →  User Service   (HAL+JSON)
  ├─ [async] GET {item.address}   →  User Service   (HAL+JSON)
  ├─ [async] GET {item.card}      →  User Service   (HAL+JSON)
  ├─ [async] GET {item.items}     →  Cart Service   (JSON)
  │
  │  (wait for all four futures, up to ${http.timeout} seconds each)
  │
  ├─ calculateTotal(items)         →  sum(qty * unitPrice) + $4.99 shipping
  │
  ├─ [async] POST payment/paymentAuth  →  Payment Service  (JSON)
  │  Body: PaymentRequest { address, card, customer, amount }
  │  Response: PaymentResponse { authorised, message }
  │
  ├─ [async] POST shipping/shipping    →  Shipping Service (JSON)
  │  Body: Shipment { id: UUID, name: customerId }
  │
  └─ Save CustomerOrder to MongoDB
```

### Service URLs

| Service  | URI Construction                                      | Default Resolved URL                 |
|----------|------------------------------------------------------|--------------------------------------|
| Payment  | `http://payment{.domain}/paymentAuth`                 | `http://payment/paymentAuth`         |
| Shipping | `http://shipping{.domain}/shipping`                   | `http://shipping/shipping`           |
| User     | Caller-supplied URI (from `NewOrderResource.customer`, `.address`, `.card`) | Typically `http://user/customers/{id}` etc. |
| Cart     | Caller-supplied URI (from `NewOrderResource.items`)   | Typically `http://carts/{id}/items`  |

The `domain` suffix is configurable via `OrdersConfigurationProperties.setDomain()` (e.g., set to `sock-shop.svc.cluster.local` in Kubernetes).

### HTTP Client

- `RestTemplate` wrapped in `RestProxyTemplate` — supports optional HTTP proxy (`proxy.host`, `proxy.port`)
- All calls use `AsyncGetService` with `@Async` annotation (Spring async execution)
- GET calls to User/Cart use `RestTemplate.exchange()` with HAL+JSON or JSON accept headers
- POST calls to Payment/Shipping use `RestTemplate.exchange()` with JSON content type

### Timeout Configuration

| Property         | Default | Scope                              |
|------------------|---------|------------------------------------|
| `http.timeout`   | 5 sec   | `Future.get()` timeout per downstream call |
| MongoDB `serverSelectionTimeout` | 10 sec | MongoDB client connection |

---

## 4. Security Assessment

### Authentication / Authorization

- **None.** There is no authentication or authorization on the `/orders` endpoint.
- The `GET /orders` and `GET /orders/search/customerId` endpoints are exposed without access control — any caller can read any customer's orders.
- Orders are scoped by `customerId` in the search endpoint, but there is no verification that the requesting user matches the `custId` parameter.

### SSRF Risk (Critical)

The `NewOrderResource` accepts **caller-supplied URIs** for `customer`, `address`, `card`, and `items`. These URIs are fetched server-side by `AsyncGetService` using `RestTemplate`. While the `@URL` annotation validates URI format, it does **not** restrict the target host.

**Attack vector:** A malicious client can supply URIs pointing to:
- Internal infrastructure (cloud metadata endpoints, internal APIs)
- Other microservices not intended to be accessed
- Localhost services on the Orders host

**Mitigation needed:** Allowlist of permitted hostnames/schemes, or restrict to service-internal base URLs.

### Sensitive Data Exposure

- `Card` entity stores `longNum` (full card number), `expires`, and `ccv` in plaintext.
- These values are embedded in the `CustomerOrder` MongoDB document — full card details persist with every order.
- `PaymentRequest.toString()` logs card and customer data at INFO level.

---

## 5. Performance Analysis

### Parallel vs Sequential Calls

The initial four data fetches (customer, address, card, items) are dispatched **in parallel** using Spring `@Async`. This is efficient.

However, the subsequent calls are **sequential by necessity**:
1. Wait for all four fetches → calculate total
2. POST to Payment (must have total + resolved entities)
3. POST to Shipping (must have customerId from resolved customer)
4. Build and save order

Payment and Shipping calls could theoretically be parallelized if the shipping call didn't depend on the customer ID (which is already resolved at that point). Currently shipping is dispatched after payment authorization succeeds, adding latency but providing a correctness guarantee (no shipment created for declined payments).

### Timeout Behavior

Each `Future.get()` call has an independent timeout of `${http.timeout}` seconds (default 5). In the worst case, the order creation makes **7 Future.get() calls** (some futures are `.get()`'d multiple times for the same result), each potentially waiting up to 5 seconds. The theoretical maximum latency before timeout is ~35 seconds, though in practice resolved futures return immediately on subsequent `.get()` calls.

### Connection Configuration

- `RestTemplate` uses default `SimpleClientHttpRequestFactory` (no connection pooling by default)
- No read/connect timeout configured on the `RestTemplate` itself — only the `Future.get()` timeout bounds wait time
- Optional HTTP proxy support via `proxy.host` / `proxy.port`

### MongoDB

- `serverSelectionTimeout`: 10 seconds
- Connection URI: `mongodb://orders-db:27017/data` (no replica set, no auth)
- Single `save()` call per order

### Hardcoded Shipping Cost

Shipping is hardcoded at `$4.99` in `calculateTotal()` — not fetched from any service or configuration.

---

## 6. Configuration Reference

| Property                   | Default               | Description                        |
|----------------------------|-----------------------|------------------------------------|
| `port`                     | `8082`                | Server port                        |
| `spring.data.mongodb.uri`  | `mongodb://orders-db:27017/data` | MongoDB connection           |
| `http.timeout`             | `5`                   | Downstream call timeout (seconds)  |
| `proxy.host`               | *(empty)*             | HTTP proxy hostname                |
| `proxy.port`               | *(empty)*             | HTTP proxy port                    |
| `domain`                   | *(empty)*             | Service domain suffix (e.g. `.svc.cluster.local`) |
| `spring.zipkin.baseUrl`    | `http://zipkin:9411/` | Zipkin tracing endpoint            |
| `spring.zipkin.enabled`    | `false`               | Enable distributed tracing         |
| `spring.sleuth.sampler.percentage` | `1.0`         | Trace sampling rate                |
