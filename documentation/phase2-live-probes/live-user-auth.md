# Sock Shop — Live User & Auth Audit

> Live API probe against `http://localhost:8888`. Executed 2026-03-16.

---

## 1. Pre-Seeded Users

Three users are pre-seeded in the database (from `GET /customers`):

| Username | First Name | Last Name | Customer ID | Address ID | Card ID |
|----------|-----------|-----------|-------------|------------|---------|
| `Eve_Berger` | Eve | Berger | `57a98d98e4b00679b4a830af` | `57a98d98e4b00679b4a830ad` | `57a98d98e4b00679b4a830ae` |
| `user` | User | Name | `57a98d98e4b00679b4a830b2` | `57a98d98e4b00679b4a830b0` | `57a98d98e4b00679b4a830b1` |
| `user1` | User1 | Name1 | `57a98d98e4b00679b4a830b5` | `57a98d98e4b00679b4a830b3` | `57a98d98e4b00679b4a830b4` |

**Note:** Email addresses are not exposed in JSON responses (field tagged `json:"-"`), confirming the Phase 1 documentation.

---

## 2. Auth Flow Verification

### Login Tests (`GET /login` with HTTP Basic Auth)

| Username | Password | HTTP Status | Result |
|----------|----------|-------------|--------|
| `user` | `password` | 200 | Success — session cookie set |
| `user1` | `password` | 200 | Success — session cookie set |
| `Eve_Berger` | `eve` | 200 | Success — session cookie set |
| `testprobe` | `testpass123` | 200 | Success — newly registered user can log in |
| `baduser` | `badpass` | 401 | Rejected — no cookie set |

### Cookie Behavior

On successful login, three cookies are set:

| Cookie | Value (example) | Flags | Notes |
|--------|----------------|-------|-------|
| `md.sid` | `s%3A<session-id>.<signature>` | `Path=/; HttpOnly` | Express session cookie — `HttpOnly` is set |
| `logged_in` | `<session-id>` | `Max-Age=3600; Path=/` | **Missing `HttpOnly` and `Secure` flags** — vulnerable to XSS cookie theft |
| `_TRAEFIK_BACKEND` | `http://front-end:8079` | none | Traefik routing cookie — leaks internal hostname |

**Findings:**
- `logged_in` cookie **lacks `HttpOnly`** — accessible to JavaScript (XSS risk). Confirms VULN-012.
- `logged_in` cookie **lacks `Secure`** — transmitted over HTTP. Confirms VULN-012.
- `_TRAEFIK_BACKEND` cookie **exposes internal service hostname** (`front-end:8079`).
- Login response body is just the string `Cookie is set` — the front-end proxy handles the login flow and does not return the user object to the client directly.

### Session Behavior

- Without a session cookie, `GET /customers/{id}` returns a 500 error ("Invalid Id Hex").
- With a valid session cookie, the endpoint returns the **logged-in user's data regardless of the ID in the URL**. Requesting `Eve_Berger`'s customer ID while logged in as `user` returns `user`'s data — the front-end overrides the requested ID with the session's customer ID.
- This means the front-end gateway partially mitigates IDOR (VULN-006) for the `/customers/{id}` route, but the backend user service itself has no such protection.

---

## 3. Data Exposure Audit

### Cards — `GET /cards` (No Authentication Required)

**CRITICAL: Full card data returned unmasked and without any authentication.**

| Card ID | longNum (Full Number) | Expires | CCV | Owner (inferred) |
|---------|----------------------|---------|-----|-----------------|
| `...830ae` | `5953580604169678` | `08/19` | `678` | Eve_Berger |
| `...830b1` | `5544154011345918` | `08/19` | `958` | user |
| `...830b4` | `0908415193175205` | `08/19` | `280` | user1 |
| `...830d2` | `5429804235432` | `04/16` | `432` | unknown (extra card) |

**Confirmed vulnerabilities:**
- **VULN-001 (Plaintext Card Storage):** Full 16-digit card numbers stored and returned in plaintext.
- **VULN-007 (Unmasked Card Data on GET):** `GET /cards` returns full `longNum`, `expires`, and `ccv` with zero authentication.
- **PCI-DSS Req 3 violation:** CCV values are stored and returned — CCV must never be stored post-authorization.
- 4 cards exist for 3 users — one user has an additional card (ID `...830d2`).

### Addresses — `GET /addresses` (No Authentication Required)

All addresses returned without authentication:

| Address ID | Street | Number | City | Postcode | Country |
|-----------|--------|--------|------|----------|---------|
| `...830ad` | Whitelees Road | 246 | Glasgow | G67 3DL | United Kingdom |
| `...830b0` | Whitelees Road | 246 | Glasgow | G67 3DL | United Kingdom |
| `...830b3` | Maes-Y-Deri | 4 | Aberdare | CF44 6TF | United Kingdom |
| `...830d1` | my road | 3 | London | *(empty)* | UK |

**Findings:**
- All personal address data is publicly accessible without authentication.
- Two addresses are identical (different IDs) — likely belong to `Eve_Berger` and `user`.
- Address `...830d1` has an empty postcode and informal data — likely test data.

### Customers — `GET /customers` (No Authentication Required)

- Returns all usernames, first/last names, and customer IDs without authentication.
- Email is correctly omitted from JSON responses.
- Password and salt are correctly omitted from JSON responses.
- HAL-style `_links` expose internal service hostname (`http://user/customers/...`).

---

## 4. Registration Test

### Request

```
POST /register
Content-Type: application/json

{
  "username": "testprobe",
  "password": "testpass123",
  "email": "test@probe.local",
  "firstName": "Test",
  "lastName": "Probe"
}
```

### Response

```json
{"id": "69b863d2ee11cb0001112184"}
```

- **Status:** 200 OK — registration succeeded.
- **Login verified:** `testprobe:testpass123` authenticates successfully.
- **No rate limiting detected:** Registration endpoint accepts requests without throttling.
- **No password complexity enforcement:** Simple password `testpass123` was accepted.
- **No email verification:** Account is immediately active.

---

## 5. Schema Validation (vs. Phase 1 Documentation)

| Documented Behavior | Live Result | Match? |
|-------------------|-------------|--------|
| `GET /customers` returns `_embedded.customer[]` | Confirmed — 3 pre-seeded users | YES |
| `GET /login` uses HTTP Basic Auth | Confirmed — `Authorization: Basic` header | YES |
| Login returns masked card numbers (`************1234`) | **NOT directly observable** — front-end returns `Cookie is set` instead of user object | PARTIAL |
| `GET /cards` returns unmasked card data | Confirmed — full `longNum`, `expires`, `ccv` | YES |
| `GET /addresses` returns all addresses | Confirmed — 4 addresses returned | YES |
| `POST /register` returns `{ "id": "string" }` | Confirmed — returns new user ID | YES |
| Email omitted from JSON responses (`json:"-"`) | Confirmed — no email in any response | YES |
| Password/salt omitted from JSON responses | Confirmed — not present in any response | YES |
| HAL+JSON response format with `_links` | Confirmed on all entity responses | YES |
| Invalid login returns 401 | Confirmed | YES |
| No authorization on any endpoint | Confirmed — `/cards`, `/addresses`, `/customers` all accessible without auth | YES |

---

## 6. Security Summary

### Confirmed Vulnerabilities (from synthesis-security.md)

| ID | Finding | Live Confirmed? | Evidence |
|----|---------|----------------|----------|
| VULN-001 | Plaintext card storage | **YES** | `GET /cards` returns full numbers and CCVs |
| VULN-005 | No inter-service auth | **YES** | All data endpoints accessible without authentication |
| VULN-006 | IDOR on all services | **PARTIAL** | Front-end overrides customer ID with session, but `/cards` and `/addresses` have no ownership checks |
| VULN-007 | Unmasked card data on GET | **YES** | `GET /cards` returns 4 cards with full data |
| VULN-012 | No cookie security flags | **YES** | `logged_in` cookie missing `HttpOnly` and `Secure` |

### Additional Live Findings

| Finding | Severity | Detail |
|---------|----------|--------|
| Internal hostname leakage | LOW | `_TRAEFIK_BACKEND` cookie exposes `front-end:8079`; `_links` expose `http://user/...` |
| No registration rate limiting | MEDIUM | No throttling on `POST /register` |
| No password complexity rules | MEDIUM | Trivial passwords accepted |
| No email verification | LOW | Accounts active immediately |
| 500 error on unauthenticated `/customers/{id}` | LOW | Returns "Invalid Id Hex" instead of 401 — error leaks implementation detail |
| Extra orphaned card/address | LOW | Card `...830d2` and address `...830d1` exist without clear user association |
