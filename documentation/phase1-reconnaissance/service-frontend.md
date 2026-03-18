# Front-End Gateway Service Profile

**Service:** `front-end`
**Technology:** Node.js / Express 4.x
**Port:** 8079 (configurable via `PORT` env var)
**Role:** API gateway — proxies all client requests to backend microservices and serves static assets.

---

## 1. Gateway Routes

### Catalogue Service (`http://catalogue`)

| Method | Route | Backend Call | Description |
|--------|-------|-------------|-------------|
| GET | `/catalogue*` | `GET http://catalogue{url}` | Proxy catalogue queries (list, search, detail) |
| GET | `/catalogue/images*` | `GET http://catalogue{url}` | Stream catalogue images (piped directly) |
| GET | `/tags` | `GET http://catalogue/tags` | List product tags |

### Cart Service (`http://carts`)

| Method | Route | Backend Call | Description |
|--------|-------|-------------|-------------|
| GET | `/cart` | `GET http://carts/carts/{custId}/items` | List items in current user's cart |
| POST | `/cart` | `GET catalogue` then `POST http://carts/carts/{custId}/items` | Add item to cart (fetches price from catalogue first) |
| POST | `/cart/update` | `GET catalogue` then `PATCH http://carts/carts/{custId}/items` | Update item quantity (fetches price from catalogue first) |
| DELETE | `/cart` | `DELETE http://carts/carts/{custId}` | Delete entire cart |
| DELETE | `/cart/:id` | `DELETE http://carts/carts/{custId}/items/{id}` | Delete single cart item |

### Orders Service (`http://orders`)

| Method | Route | Backend Call | Description |
|--------|-------|-------------|-------------|
| GET | `/orders` | `GET http://orders/orders/search/customerId?sort=date&custId={id}` | List orders for logged-in user |
| GET | `/orders/*` | `GET http://orders{url}` | Proxy any order sub-resource (piped directly) |
| POST | `/orders` | Multi-step: fetches customer, address, card from user service, then `POST http://orders/orders` | Create new order |

### User Service (`http://user`)

| Method | Route | Backend Call | Description |
|--------|-------|-------------|-------------|
| GET | `/customers/:id` | `GET http://user/customers/{session.customerId}` | Get customer (ignores URL param, uses session) |
| GET | `/customers` | `GET http://user/customers` | List customers |
| POST | `/customers` | `POST http://user/customers` | Create customer (testing only) |
| DELETE | `/customers/:id` | `DELETE http://user/customers/{id}` | Delete customer (testing only) |
| GET | `/addresses` | `GET http://user/addresses` | List addresses |
| POST | `/addresses` | `POST http://user/addresses` | Create address (injects `userID` from session) |
| DELETE | `/addresses/:id` | `DELETE http://user/addresses/{id}` | Delete address (testing only) |
| GET | `/address` | `GET http://user/customers/{custId}/addresses` | Get primary address for current user |
| GET | `/cards` | `GET http://user/cards` | List cards |
| GET | `/cards/:id` | `GET http://user/cards/{id}` | Get specific card |
| POST | `/cards` | `POST http://user/cards` | Create card (injects `userID` from session) |
| DELETE | `/cards/:id` | `DELETE http://user/cards/{id}` | Delete card (testing only) |
| GET | `/card` | `GET http://user/customers/{custId}/cards` | Get primary card (returns last 4 digits only) |
| GET | `/login` | `GET http://user/login` (forwards `Authorization` header) | Log in user |
| POST | `/register` | `POST http://user/register` | Register new user |

### Static Assets
- `express.static("public")` serves the SPA frontend (HTML/CSS/JS).

---

## 2. Data Aggregation

The front-end performs non-trivial data aggregation in several routes:

- **POST `/cart`** — Waterfall: fetches item details from catalogue (to get `unitPrice`), then POSTs to carts service. The client only sends `id`; the gateway enriches the payload.
- **POST `/cart/update`** — Same pattern: fetches catalogue item, then PATCHes the carts service with `unitPrice` + `quantity`.
- **POST `/orders`** — Three-step waterfall:
  1. Fetches customer profile from user service (gets HAL `_links` for customer, addresses, cards).
  2. Parallel fetch of address and card links from user service.
  3. Assembles order payload (`customer`, `address`, `card`, `items` URLs) and POSTs to orders service.
- **GET `/card`** — Fetches full card data, returns only `{ number: last4digits }` — a data-masking transform.
- **GET `/address`** — Fetches address list, returns only the first address.
- **Login/Register** — After auth, merges anonymous session cart with the authenticated customer's cart via `GET /carts/{custId}/merge?sessionId={sessionId}`.

---

## 3. Session Management

### Session Configuration (`config.js`)

| Setting | Value |
|---------|-------|
| Cookie name | `md.sid` |
| Secret | `sooper secret` (hardcoded) |
| `resave` | `false` |
| `saveUninitialized` | `true` |

### Session Store
- **Redis** (when `SESSION_REDIS` env var is set): uses `connect-redis` with host `session-db`.
- **In-memory** (default): Express's built-in MemoryStore (not production-safe).

### Session Data Stored
- `req.session.customerId` — set on login/register, used to identify the user for all backend calls.
- `req.session.id` — used as anonymous cart identifier for unauthenticated users.

---

## 4. Auth Flow

### Login (`GET /login`)
1. Client sends `Authorization` header (HTTP Basic Auth).
2. Gateway forwards the `Authorization` header to `http://user/login`.
3. On 200 response, extracts `body.user.id` and stores it in `req.session.customerId`.
4. Merges anonymous cart (keyed by session ID) into customer's cart via carts service.
5. Sets `logged_in` cookie with value `req.session.id`, `maxAge: 3600000` (1 hour).

### Register (`POST /register`)
1. Client sends registration body (username, password, email, etc.).
2. Gateway POSTs to `http://user/register`.
3. On success, stores `body.id` as `req.session.customerId`.
4. Merges anonymous cart into customer cart.
5. Sets `logged_in` cookie (same as login), responds with `{ id: custId }`.

### Auth Propagation to Backends
- **No auth headers forwarded** to backend services (except login). Backend calls are unauthenticated service-to-service HTTP.
- Auth state is determined solely by the `logged_in` cookie and `req.session.customerId`.

### Customer ID Resolution (`helpers.getCustomerId`)
1. If `development` env and `req.query.custId` is set — returns query param directly (**security risk**, marked as TODO to remove).
2. If `logged_in` cookie is absent — returns `req.session.id` (anonymous session).
3. If `logged_in` cookie is present — returns `req.session.customerId`.

---

## 5. Inter-Service Calls

### HTTP Client
- **`request`** library (v2.72.x) — all backend calls use `request` or `request.get`.
- No connection pooling configuration (uses Node.js default agent).
- No request timeouts configured.

### Service Discovery
- **DNS-based** via hardcoded hostnames in `api/endpoints.js`:
  - `http://catalogue` — Catalogue service
  - `http://carts/carts` — Carts service
  - `http://orders` — Orders service
  - `http://user/customers` — User service (customers)
  - `http://user/addresses` — User service (addresses)
  - `http://user/cards` — User service (cards)
  - `http://user/login` — User service (login)
  - `http://user/register` — User service (register)
- An optional `--domain` CLI arg appends a domain suffix (e.g., `http://catalogue.sock-shop`).
- **No env vars** for service URLs — all hardcoded.

### Call Patterns
- **Simple proxy** (`helpers.simpleHttpRequest`): GET to backend, forward response body with 200.
- **Piped streams**: `request.get(url).pipe(res)` for images and order sub-resources.
- **Async waterfall** (`async.waterfall`): sequential multi-service calls for cart add, cart update, order creation, login, register.
- **Async parallel** (`async.parallel`): concurrent address + card fetch during order creation.

---

## 6. Security

### Critical Issues

| Severity | Issue | Location |
|----------|-------|----------|
| **HIGH** | Hardcoded session secret `'sooper secret'` | `config.js:10,18` |
| **HIGH** | Dev-mode custId override via query param (`?custId=`) allows impersonation | `helpers/index.js:106-108` |
| **MEDIUM** | `logged_in` cookie has no `httpOnly` flag — accessible to client-side JavaScript | `api/user/index.js:240,305` |
| **MEDIUM** | `logged_in` cookie has no `secure` flag — sent over plain HTTP | `api/user/index.js:240,305` |
| **MEDIUM** | No CORS configuration — defaults to Express's permissive default | `server.js` |
| **MEDIUM** | No Helmet.js or equivalent — missing security headers (X-Frame-Options, X-XSS-Protection, CSP, etc.) | `server.js` |
| **LOW** | `saveUninitialized: true` creates sessions for every request (session fixation risk) | `config.js:12,20` |
| **LOW** | Error handler leaks full error objects to client (`err.message` + `err` stack) | `helpers/index.js:15-23` |
| **LOW** | `GET /customers/:id` ignores the URL parameter and always uses session customerId — misleading API | `api/user/index.js:7-9` |

### Positive Security
- Trailing-slash redirect has a denylist check for `//` to prevent open redirect via protocol-relative URLs (`helpers/index.js:55-59`).

---

## 7. Performance

### Connection Pooling
- **None configured.** Uses `request` library defaults, which in turn uses Node.js `http.globalAgent` with `maxSockets: Infinity` (Node 12+) or 5 (older). No keep-alive configuration.

### Request Timeouts
- **None.** No timeout set on any backend `request()` call. A hung backend will hold the client connection indefinitely.

### Caching
- **No caching headers** set on API responses. `express.static` serves files from `public/` with Express's default caching (ETag-based).
- No in-memory caching of catalogue data or other frequently-accessed resources.

### Middleware Chain
Order of middleware execution:
1. `helpers.rewriteSlash` — redirect trailing slashes
2. `metrics` — Prometheus metrics (prom-client)
3. `express.static("public")` — serve static files
4. `express-session` — session management (Redis or memory)
5. `bodyParser.json()` — parse JSON bodies
6. `cookieParser()` — parse cookies
7. `helpers.sessionMiddleware` — clear customerId if not logged in (note: has bug — uses `err` as first param but is mounted as regular middleware)
8. `morgan("dev")` — request logging
9. Route handlers (cart, catalogue, orders, user)
10. `helpers.errorHandler` — error handling

### Session Middleware Bug
`helpers.sessionMiddleware` is defined with signature `(err, req, res, next)` — Express treats 4-arg functions as error middleware, so this **never executes** as intended regular middleware. The session cleanup logic for logged-out users is effectively dead code.

---

## Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| express | ^4.13.4 | Web framework |
| request | ^2.72.0 | HTTP client for backend calls |
| async | ^1.5.2 | Waterfall/parallel flow control |
| express-session | ^1.13.0 | Session management |
| connect-redis | ^3.2.0 | Redis session store |
| body-parser | ^1.15.1 | JSON body parsing |
| cookie-parser | ^1.4.3 | Cookie parsing |
| morgan | ^1.7.0 | HTTP request logging |
| prom-client | ^6.3.0 | Prometheus metrics |
| serve-static | ^1.10.2 | Static file serving |

---

## Backend Service Dependency Map

```
                    ┌──────────────┐
                    │  front-end   │
                    │  (gateway)   │
                    │  :8079       │
                    └──────┬───────┘
           ┌───────────────┼───────────────┐───────────────┐
           ▼               ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  catalogue  │ │    carts    │ │   orders    │ │    user     │
    └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
                                                           │
                                                    ┌──────┴──────┐
                                                    │  session-db │
                                                    │   (Redis)   │
                                                    └─────────────┘
```
