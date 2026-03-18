# User Service Profile

## Overview

Go microservice built on the **go-kit** framework. Manages user accounts, addresses, and payment cards. Backed by **MongoDB** (service name: `user-db`). Default listen port: **8084**.

---

## Endpoints

### Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/login` | HTTP Basic Auth | Authenticate user; returns user object with masked card numbers |
| `POST` | `/register` | None | Register a new user account |

#### `GET /login`

- **Request:** HTTP Basic Auth header (`Authorization: Basic base64(username:password)`)
- **Response:**
```json
{
  "user": {
    "firstName": "string",
    "lastName": "string",
    "username": "string",
    "id": "string",
    "_links": { ... },
    "addresses": [ ... ],
    "cards": [ { "longNum": "************1234", ... } ]
  }
}
```
- Card numbers are masked on login (only last 4 digits visible).
- Returns `401 Unauthorized` if credentials are invalid.

#### `POST /register`

- **Request body:**
```json
{
  "username": "string",
  "password": "string",
  "email": "string",
  "firstName": "string",
  "lastName": "string"
}
```
- **Response:**
```json
{ "id": "string" }
```

### Customers

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/customers` | List all customers |
| `GET` | `/customers/{id}` | Get customer by ID |
| `GET` | `/customers/{id}/addresses` | Get customer's addresses |
| `GET` | `/customers/{id}/cards` | Get customer's cards |
| `POST` | `/customers` | Create a customer (full User object) |

- **GET list response:** `{ "_embedded": { "customer": [ ... ] } }`
- **GET single response:** Full `User` object (HAL+JSON)
- **POST request body:** Full `User` JSON object
- **POST response:** `{ "id": "string" }`

### Addresses

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/addresses` | List all addresses |
| `GET` | `/addresses/{id}` | Get address by ID |
| `POST` | `/addresses` | Create an address |

- **POST request body:**
```json
{
  "street": "string",
  "number": "string",
  "country": "string",
  "city": "string",
  "postcode": "string",
  "userID": "string"
}
```
- **POST response:** `{ "id": "string" }`

### Cards

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/cards` | List all cards |
| `GET` | `/cards/{id}` | Get card by ID |
| `POST` | `/cards` | Create a card |

- **POST request body:**
```json
{
  "longNum": "string",
  "expires": "string",
  "ccv": "string",
  "userID": "string"
}
```
- **POST response:** `{ "id": "string" }`

### Delete

| Method | Path | Description |
|--------|------|-------------|
| `DELETE` | `/{entity}/{id}` | Delete entity by type and ID |

- `entity` can be `customers`, `addresses`, or `cards`.
- Deleting a customer cascades: removes all linked addresses and cards.
- Deleting an address or card also removes the reference from the parent customer document.
- **Response:** `{ "status": true/false }`

### Operational

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check (app + DB) |
| `GET` | `/metrics` | Prometheus metrics |

- **Health response:**
```json
{
  "health": [
    { "service": "user", "status": "OK", "time": "..." },
    { "service": "user-db", "status": "OK", "time": "..." }
  ]
}
```

---

## Data Model

### User

| Field | Go Type | JSON Tag | BSON Tag | Notes |
|-------|---------|----------|----------|-------|
| FirstName | `string` | `firstName` | `firstName` | |
| LastName | `string` | `lastName` | `lastName` | |
| Email | `string` | `-` (omitted) | `email` | Not exposed in JSON responses |
| Username | `string` | `username` | `username` | Unique index in MongoDB |
| Password | `string` | `-` (omitted) | `password,omitempty` | SHA-1 salted hash; never serialized to JSON |
| Addresses | `[]Address` | `-,omitempty` | `-` | Loaded via separate collection lookup |
| Cards | `[]Card` | `-,omitempty` | `-` | Loaded via separate collection lookup |
| UserID | `string` | `id` | `-` | Derived from MongoDB `_id` ObjectId |
| Links | `Links` | `_links` | | HAL-style hypermedia links |
| Salt | `string` | `-` (omitted) | `salt` | Random per-user; SHA-1 of nanosecond timestamp |

**MongoDB wrapper** (`MongoUser`): embeds `User` inline, adds `_id` (ObjectId), `addresses` ([]ObjectId), `cards` ([]ObjectId).

### Address

| Field | Go Type | JSON Tag | BSON Tag |
|-------|---------|----------|----------|
| Street | `string` | `street` | `street,omitempty` |
| Number | `string` | `number` | `number,omitempty` |
| Country | `string` | `country` | `country,omitempty` |
| City | `string` | `city` | `city,omitempty` |
| PostCode | `string` | `postcode` | `postcode,omitempty` |
| ID | `string` | `id` | `-` |
| Links | `Links` | `_links` | |

### Card

| Field | Go Type | JSON Tag | BSON Tag |
|-------|---------|----------|----------|
| LongNum | `string` | `longNum` | `longNum` |
| Expires | `string` | `expires` | `expires` |
| CCV | `string` | `ccv` | `ccv` |
| ID | `string` | `id` | `-` |
| Links | `Links` | `_links` | `-` |

---

## Dependencies

### MongoDB (`user-db`)

- **Driver:** `gopkg.in/mgo.v2` (mgo v2)
- **Database name:** `users`
- **Collections:** `customers`, `addresses`, `cards`
- **Connection config (flags / env vars):**
  - `--mongo-user` / `MONGO_USER`
  - `--mongo-password` / `MONGO_PASS`
  - `--mongo-host` / `MONGO_HOST`
  - `--database` / `USER_DATABASE` (must be set to `"mongodb"`)
- **Connection timeout:** 5 seconds
- **Session management:** `Session.Copy()` per operation (connection pooling via mgo)

### Tracing

- **OpenTracing** with optional **Zipkin** collector
- Config: `--zipkin` / `ZIPKIN` env var
- Noop tracer used when Zipkin address is empty

### Metrics

- **Prometheus** metrics exposed at `/metrics`
- HTTP-level histogram: `http_request_duration_seconds` (method, path, status_code, isWS)
- Service-level counter: `microservices_demo_user_request_count` (method)
- Service-level summary: `microservices_demo_user_request_latency_microseconds` (method)

---

## Security

### Password Hashing

- **Algorithm:** SHA-1 (`crypto/sha1`)
- **Scheme:** `SHA1(salt + password)` — salt is prepended, result stored as hex string
- **Salt generation:** `SHA1(time.Now().UnixNano())` — one salt per user, generated at user creation

> **Risk: SHA-1 is cryptographically weak.** It is fast to brute-force and not suitable for password hashing. Industry standard is bcrypt, scrypt, or argon2id.

### Login Mechanism

- HTTP **Basic Auth** on `GET /login`
- Credentials extracted via `r.BasicAuth()`
- Username looked up in MongoDB, password hash compared
- No session/token management — the service returns the user object directly; session handling is external

### Data Exposure

- **Email:** Never returned in JSON responses (`json:"-"`)
- **Password/Salt:** Never returned in JSON responses (`json:"-"`)
- **Card numbers on login:** Masked to `************1234` format via `MaskCCs()`
- **Card numbers on GET /cards and GET /customers/{id}/cards:** **NOT masked** — full card numbers, expiry dates, and CCVs are returned in plain text

> **Risk: Card data returned unmasked on GET endpoints.** Only the `/login` endpoint masks credit card numbers. Direct GET requests to `/cards` or `/customers/{id}/cards` return full `longNum`, `expires`, and `ccv` values. This is a significant PCI-DSS compliance issue.

### Authorization

- **No authorization middleware exists.** All endpoints are publicly accessible without authentication (except `/login` which requires Basic Auth to identify the user, not to protect the endpoint).
- Any caller can read/create/delete any user, address, or card.

---

## Performance Considerations

### MongoDB Indexing

- **Unique index on `username`** in the `customers` collection (created at startup via `EnsureIndexes()`)
  - Flags: `Unique: true`, `DropDups: true`, `Background: true`
- No other indexes are defined — queries by `_id` use the default `_id` index

### Query Patterns

- **GetUsers / GetCards / GetAddresses (list all):** `Find(nil).All()` — no pagination, loads entire collection into memory
  - Code contains `// TODO: add pagination` comments
- **GetUserAttributes:** Uses `$in` query to batch-load addresses and cards by their ObjectId arrays — efficient for small sets
- **User creation:** Addresses and cards are created in individual `UpsertId` calls (no bulk insert)
- **Delete customer:** Cascading delete uses `RemoveAll` with `$in` for addresses/cards, then `Remove` for the customer — not atomic

### Connection Management

- mgo session copied per operation (`Session.Copy()`), returned via `defer s.Close()` — standard mgo pooling pattern
- Startup retries DB connection in a tight loop (no backoff)
- Note: `createCards` calls `s.Close()` twice (duplicate `defer s.Close()`) — minor resource issue

### Content Type

- All responses use `application/hal+json` content type (HAL-style hypermedia)

---

## Architecture

```
main.go
  ├── db.Register("mongodb", &mongodb.Mongo{})
  ├── db.Init()  →  mongodb.Init()  →  mgo.DialWithTimeout + EnsureIndexes
  ├── api.NewFixedService()
  │     └── fixedService (business logic)
  ├── api.LoggingMiddleware(logger)
  ├── api.NewInstrumentingService(counter, histogram)
  ├── api.MakeEndpoints(service, tracer)
  ├── api.MakeHTTPHandler(endpoints, logger, tracer)
  └── commonMiddleware.Merge(httpMiddleware).Wrap(router)
        └── http.ListenAndServe(:8084, handler)
```

The service follows go-kit's layered architecture:
1. **Transport** (`transport.go`) — HTTP/JSON decoding/encoding via gorilla/mux
2. **Endpoints** (`endpoints.go`) — request/response mapping with OpenTracing spans
3. **Service** (`service.go`) — business logic interface and implementation
4. **Middleware** (`middlewares.go`) — logging (go-kit/log) and instrumentation (Prometheus)
5. **DB** (`db/db.go`, `db/mongodb/mongodb.go`) — pluggable database layer with MongoDB implementation
