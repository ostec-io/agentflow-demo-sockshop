# Payment Service Profile

## Overview

The Payment service is a stateless Go microservice built on the [go-kit](https://gokit.io/) framework. It provides a simple payment authorisation endpoint that approves or declines transactions based on a configurable amount threshold. It has no database or external service dependencies.

- **Language:** Go
- **Framework:** go-kit
- **Default Port:** 8080
- **Service Name:** `payment`

---

## Endpoints

### POST `/paymentAuth`

Authorises a payment transaction. Approves amounts up to the configured decline threshold (default: 105); declines amounts above it.

**Request Body:**

```json
{
  "amount": 42.50
}
```

| Field    | Type    | Required | Description                  |
|----------|---------|----------|------------------------------|
| `amount` | float32 | Yes      | Total transaction amount     |

**Response (200 OK):**

```json
{
  "authorised": true,
  "message": "Payment authorised"
}
```

**Declined response:**

```json
{
  "authorised": false,
  "message": "Payment declined: amount exceeds 105.00"
}
```

**Error response (500):**

```json
{
  "error": "Invalid payment amount",
  "status_code": 500,
  "status_text": "Internal Server Error"
}
```

**Validation rules:**
- `amount == 0` → error (`Invalid payment amount`)
- `amount < 0` → error (`Invalid payment amount`)
- `amount` missing from JSON → transport-level error (`Cannot unmarshal object key "amount"`)

---

### GET `/health`

Returns the health status of the service.

**Response (200 OK):**

```json
{
  "health": [
    {
      "service": "payment",
      "status": "OK",
      "time": "2026-03-16 10:00:00.000000 +0000 UTC"
    }
  ]
}
```

---

### GET `/metrics`

Prometheus metrics endpoint (served via `promhttp.Handler()`). Exposes the `http_request_duration_seconds` histogram, bucketed by `method`, `path`, `status_code`, and `isWS`.

---

## Data Model

### `Authorisation`

```go
type Authorisation struct {
    Authorised bool   `json:"authorised"`
    Message    string `json:"message"`
}
```

### `AuthoriseRequest`

```go
type AuthoriseRequest struct {
    Amount float32 `json:"amount"`
}
```

### `AuthoriseResponse`

```go
type AuthoriseResponse struct {
    Authorisation Authorisation
    Err           error
}
```

### `Health`

```go
type Health struct {
    Service string `json:"service"`
    Status  string `json:"status"`
    Time    string `json:"time"`
}
```

---

## Dependencies

**None.** This is a fully stateless service with no database, cache, or external service dependencies. The only optional external integration is Zipkin for distributed tracing.

| Dependency | Type        | Required | Notes                                  |
|------------|-------------|----------|----------------------------------------|
| Zipkin     | Tracing     | No       | Configured via `-zipkin` flag or `ZIPKIN` env var |

---

## Configuration

| Flag              | Env Var  | Default | Description                              |
|-------------------|----------|---------|------------------------------------------|
| `-port`           | —        | `8080`  | HTTP listener port                       |
| `-zipkin`         | `ZIPKIN` | (none)  | Zipkin collector URL for tracing         |
| `-decline`        | —        | `105`   | Decline payments over this amount        |

---

## Security Assessment

### No Authentication or Authorisation

The payment endpoint (`POST /paymentAuth`) has **no authentication or authorisation middleware**. Any client that can reach the service can submit payment authorisation requests. In the Sock Shop architecture, this is expected — the API gateway or front-end service is responsible for user authentication, and the payment service is only reachable within the internal network.

### Amount Validation

- Amounts of `0` or negative values are rejected with `ErrInvalidPaymentAmount`.
- The decline threshold is configurable at startup (default: 105). Amounts exceeding this threshold are declined but do **not** return an error — they return a successful response with `authorised: false`.

### Observations

| Finding                              | Severity | Notes                                                       |
|--------------------------------------|----------|-------------------------------------------------------------|
| No auth on `/paymentAuth`            | Medium   | Relies on network-level isolation; internal-only service    |
| No rate limiting                     | Low      | Circuit breaker (20% error threshold) provides some protection |
| `float32` for currency               | Low      | Floating-point precision issues possible with currency math |
| No TLS                               | Info     | Expected in internal service mesh; TLS typically handled by sidecar |

---

## Observability

### Logging

A `LoggingMiddleware` wraps the service and logs every call to `Authorise` and `Health` with:
- Method name
- Result (authorised boolean / health count)
- Elapsed time

Logs are written to **stderr** in logfmt format.

### Tracing

OpenTracing spans are created for each endpoint invocation:
- Span: `authorize payment` (for `/paymentAuth`)
- Span: `health check` (for `/health`)

Each span is tagged with `service: payment`.

### Metrics

Prometheus histogram `http_request_duration_seconds` is registered with labels: `method`, `path`, `status_code`, `isWS`.

---

## Resilience

### Circuit Breaker

Both endpoints are wrapped with a Handy circuit breaker (`breaker.NewBreaker(0.2)`), which trips at a 20% error rate. This protects upstream callers from cascading failures, although given the stateless nature of the service, failures are unlikely unless the process itself is unhealthy.

---

## Performance Considerations

- **Stateless:** No I/O, no database calls, no network calls. Authorisation is pure in-memory logic — latency is sub-millisecond.
- **`float32` precision:** Using `float32` for currency amounts can introduce rounding errors (e.g., `99.99` may not be represented exactly). For a demo application this is acceptable; a production service should use integer cents or `decimal` types.
- **No connection pooling or resource management needed** — the service holds no external connections.

---

## Source Files

| File                         | Purpose                                           |
|------------------------------|---------------------------------------------------|
| `cmd/paymentsvc/main.go`    | Entry point, flag parsing, Zipkin setup, HTTP server |
| `service.go`                 | `Service` interface and core `Authorise`/`Health` logic |
| `endpoints.go`               | go-kit endpoint wrappers with tracing              |
| `transport.go`               | HTTP routing, request decoding, response encoding  |
| `wiring.go`                  | Service composition: logging middleware, endpoints, HTTP handler |
| `logging.go`                 | Logging middleware for method-level observability   |
