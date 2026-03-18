# Catalogue Service Profile

**Language:** Go
**Framework:** go-kit
**Database:** MySQL (catalogue-db)
**Source:** `catalogue/`

---

## 1. Endpoints

All endpoints are read-only (GET). Each is wrapped in a circuit breaker (gobreaker, 30s timeout) and OpenTracing instrumentation.

### GET /catalogue

List socks with optional filtering, ordering, and pagination.

| Query Param | Type   | Default | Description                        |
|-------------|--------|---------|------------------------------------|
| `tags`      | string | (none)  | Comma-separated tag names to filter|
| `sort`      | string | `"id"`  | Column to ORDER BY                 |
| `page`      | int    | `1`     | Page number (1-indexed)            |
| `size`      | int    | `10`    | Page size                          |

**Response:** `200 OK` — JSON array of Sock objects (unwrapped, no envelope).

```json
[
  {
    "id": "6d62d909-...",
    "name": "Weave special",
    "description": "Limited issue Weave socks.",
    "imageUrl": ["/catalogue/images/weave1.jpg", "/catalogue/images/weave2.jpg"],
    "price": 17.15,
    "count": 33,
    "tag": ["geek", "black"]
  }
]
```

### GET /catalogue/size

Return total count of socks matching optional tag filter.

| Query Param | Type   | Default | Description                        |
|-------------|--------|---------|------------------------------------|
| `tags`      | string | (none)  | Comma-separated tag names to filter|

**Response:** `200 OK`

```json
{ "size": 10, "err": null }
```

### GET /catalogue/{id}

Get a single sock by ID.

| Path Param | Type   | Description     |
|------------|--------|-----------------|
| `id`       | string | Sock UUID       |

**Response:** `200 OK` — single Sock object (unwrapped). Returns `404` if not found.

```json
{
  "id": "6d62d909-...",
  "name": "Weave special",
  "description": "Limited issue Weave socks.",
  "imageUrl": ["/catalogue/images/weave1.jpg", "/catalogue/images/weave2.jpg"],
  "price": 17.15,
  "count": 33,
  "tag": ["geek", "black"]
}
```

### GET /tags

Return all available tag names.

**Response:** `200 OK`

```json
{ "tags": ["brown", "geek", "formal", ...], "err": null }
```

### GET /health

Health check endpoint.

**Response:** `200 OK`

```json
{
  "health": [
    { "service": "catalogue", "status": "OK", "time": "..." },
    { "service": "catalogue-db", "status": "OK", "time": "..." }
  ]
}
```

### GET /catalogue/images/{filename}

Static file server for sock images. Serves files from the `--images` directory (default `./images/`).

### GET /metrics

Prometheus metrics endpoint (via `promhttp.Handler`). Exposes `http_request_duration_seconds` histogram with labels `method`, `path`, `status_code`, `isWS`.

---

## 2. Data Model

### Go Structs

```go
type Sock struct {
    ID          string   `json:"id" db:"id"`
    Name        string   `json:"name" db:"name"`
    Description string   `json:"description" db:"description"`
    ImageURL    []string `json:"imageUrl" db:"-"`         // assembled from ImageURL_1 + ImageURL_2
    ImageURL_1  string   `json:"-" db:"image_url_1"`
    ImageURL_2  string   `json:"-" db:"image_url_2"`
    Price       float32  `json:"price" db:"price"`
    Count       int      `json:"count" db:"count"`
    Tags        []string `json:"tag" db:"-"`              // split from TagString
    TagString   string   `json:"-" db:"tag_name"`         // GROUP_CONCAT result
}

type Health struct {
    Service string `json:"service"`
    Status  string `json:"status"`
    Time    string `json:"time"`
}
```

### MySQL Tables (database: `socksdb`)

**sock**

| Column      | Type         | Notes          |
|-------------|--------------|----------------|
| sock_id     | varchar(40)  | PRIMARY KEY    |
| name        | varchar(20)  |                |
| description | varchar(200) |                |
| price       | float        |                |
| count       | int          | stock quantity |
| image_url_1 | varchar(40)  |                |
| image_url_2 | varchar(40)  |                |

**tag**

| Column | Type            | Notes                  |
|--------|-----------------|------------------------|
| tag_id | MEDIUMINT       | PRIMARY KEY, AUTO_INCREMENT |
| name   | varchar(20)     |                        |

**sock_tag** (join table)

| Column  | Type        | Notes                      |
|---------|-------------|----------------------------|
| sock_id | varchar(40) | FK → sock(sock_id)         |
| tag_id  | MEDIUMINT   | FK → tag(tag_id)           |

**Seed data:** 10 socks, 11 tags, 28 sock-tag associations.

---

## 3. Dependencies

| Dependency       | Type     | Connection Details                                                    |
|------------------|----------|-----------------------------------------------------------------------|
| **catalogue-db** | MySQL    | DSN flag: `catalogue_user:default_password@tcp(catalogue-db:3306)/socksdb` |
| **Zipkin**       | Tracing  | Optional; set via `--zipkin` flag or `ZIPKIN` env var                 |

- No dependencies on other Sock Shop microservices.
- No message broker or cache.

---

## 4. Security

### Hardcoded Credentials

**CRITICAL:** The default DSN is hardcoded in `cmd/cataloguesvc/main.go:48`:

```
catalogue_user:default_password@tcp(catalogue-db:3306)/socksdb
```

The same credentials appear in `dump.sql:1`:

```sql
CREATE USER IF NOT EXISTS 'catalogue_user' IDENTIFIED BY 'default_password';
GRANT ALL ON socksdb.* TO 'catalogue_user';
```

The DB user is granted `ALL` privileges despite the service only needing `SELECT`.

### Authentication / Authorization

- **None.** All endpoints are unauthenticated and publicly accessible. The service is purely read-only so this is by design (access control is expected at the API gateway layer).

### SQL Injection

- **Tag filtering is safe** — uses parameterized queries (`?` placeholders) for tag name values in `List()` and `Count()`.
- **ORDER BY injection risk** — In `List()` (service.go:90), the `order` parameter is passed as a bind variable (`ORDER BY ?`). MySQL will treat this as a string literal rather than a column name, so the ORDER BY will silently not work as expected. This is not a direct injection vector but is a bug — ordering is effectively non-functional.
- **Get by ID is safe** — uses parameterized query.

### Input Validation

- `page` and `size` query params use `strconv.Atoi` with errors silently ignored (defaults to 0, which returns empty results).
- No upper-bound validation on `size` — a client could request an arbitrarily large page.
- The `sort` parameter is lowercased but not validated against an allowlist of column names.

---

## 5. Performance

### Connection Pooling

- Uses `sqlx.Open()` which returns a `*sql.DB` with Go's built-in connection pool. **No custom pool settings** (MaxOpenConns, MaxIdleConns, ConnMaxLifetime) are configured, so defaults apply:
  - `MaxOpenConns`: 0 (unlimited)
  - `MaxIdleConns`: 2
  - `ConnMaxLifetime`: 0 (connections reused forever)

### Query Patterns

- **List:** Performs a 3-table JOIN (sock → sock_tag → tag) with `GROUP_CONCAT` and `GROUP BY`. Fetches **all matching rows** into memory, then paginates in Go via the `cut()` function. This means pagination does not reduce DB load — the full result set is always transferred.
- **Count:** Uses `COUNT(DISTINCT sock.sock_id)` with the same 3-table JOIN. Uses `Prepare` + `QueryRow` (prepared statement).
- **Get:** Single-row fetch using the same 3-table JOIN filtered by `sock_id`.
- **Tags:** Simple `SELECT name FROM tag` — full table scan on a small table.

### Indexes

- `sock.sock_id` — PRIMARY KEY (indexed).
- `tag.tag_id` — PRIMARY KEY (indexed).
- `sock_tag` — **No index on (sock_id, tag_id)**. The foreign keys exist but composite or individual indexes on `sock_tag` columns are not explicitly created. MySQL/InnoDB may auto-create indexes on FK columns depending on the engine, but this should be verified.

### Caching

- **None.** Every request hits the database.

### Circuit Breakers

- All endpoints are wrapped with gobreaker circuit breakers (30-second timeout per endpoint).

### Artificial Latency

- `service.go:107` contains a commented-out sleep (`time.Sleep(0 * time.Millisecond)`) that can be changed to 850ms for demo/chaos purposes.

### Scalability Concerns

1. **In-memory pagination** — The `List` endpoint fetches all rows then slices in Go. With a large catalogue this would be O(n) memory per request.
2. **No DB connection limits** — Default unlimited connections could exhaust DB resources under load.
3. **No response caching** — Catalogue data changes infrequently but is re-queried on every request.
