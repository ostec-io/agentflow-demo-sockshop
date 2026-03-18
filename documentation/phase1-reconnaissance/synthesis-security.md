# Sock Shop — Security Assessment

> Cross-service synthesis from per-service analysis profiles. Generated 2026-03-16.

---

## Executive Summary

**Overall Risk: CRITICAL**

The Sock Shop application has fundamental security weaknesses across all services. There is no inter-service authentication, no authorization on any backend endpoint, plaintext credit card storage, weak password hashing (SHA-1), hardcoded secrets, and a server-side request forgery (SSRF) vector in the order creation flow. The application was designed as a microservices demo, not a production system — security was explicitly deprioritised.

| Severity | Count |
|----------|-------|
| CRITICAL | 5 |
| HIGH | 6 |
| MEDIUM | 7 |
| LOW | 4 |

---

## Findings by Severity

### CRITICAL

#### VULN-001: Plaintext Credit Card Storage
- **Services:** user, orders
- **Impact:** Full card numbers (longNum), expiry dates, and CCVs are stored in plaintext in MongoDB (user-db and orders-db). Every order document embeds a full card snapshot.
- **PCI-DSS:** Violates Requirement 3 (Protect Stored Cardholder Data).
- **Remediation:** Tokenise card data, encrypt at rest, never store CCV.

#### VULN-002: Weak Password Hashing (SHA-1)
- **Service:** user
- **File:** `user/api/service.go`
- **Impact:** Passwords are hashed with `SHA1(salt + password)`. SHA-1 is fast and GPU-friendly — offline brute-force attacks are trivial. Salt is generated from `SHA1(time.Now().UnixNano())` which is predictable.
- **Remediation:** Use bcrypt, scrypt, or argon2id.

#### VULN-003: SSRF via Caller-Supplied URIs
- **Service:** orders
- **File:** `orders/src/main/java/works/weave/socks/orders/controllers/OrdersController.java`
- **Impact:** `POST /orders` accepts URIs for customer, address, card, and items. The orders service fetches these server-side with `RestTemplate`. An attacker can supply URIs pointing to internal infrastructure (cloud metadata, admin endpoints, localhost services).
- **Remediation:** Validate URIs against an allowlist of permitted service hostnames.

#### VULN-004: Hardcoded Session Secret
- **Service:** front-end
- **File:** `front-end/config.js`
- **Impact:** Session secret is `'sooper secret'` — hardcoded in a public GitHub repo. An attacker can forge session cookies and impersonate any user.
- **Remediation:** Load from environment variable or secrets manager. Use cryptographically random 32+ byte secret.

#### VULN-005: No Inter-Service Authentication
- **Services:** ALL
- **Impact:** No service authenticates calls from other services. Any network-adjacent attacker (or compromised container) can call any internal API directly, bypassing the gateway. Payment can be authorised, carts can be manipulated, user data can be exfiltrated.
- **Remediation:** Implement mutual TLS or service-to-service API tokens.

---

### HIGH

#### VULN-006: IDOR on All Services (No Authorization)
- **Services:** carts, orders, user
- **Impact:** No endpoint checks whether the requesting user owns the resource. User A can read User B's cart, orders, addresses, and cards by guessing or enumerating IDs.
- **Remediation:** Validate resource ownership against authenticated session.

#### VULN-007: Unmasked Card Data on GET Endpoints
- **Service:** user
- **File:** `user/api/endpoints.go`
- **Impact:** `GET /cards` and `GET /customers/{id}/cards` return full card numbers, expiry, and CCV. Only the `/login` endpoint masks cards. Direct API calls to the user service bypass masking entirely.
- **Remediation:** Mask card data at the service layer, not just in the login response.

#### VULN-008: Dev-Mode Customer ID Override
- **Service:** front-end
- **File:** `front-end/helpers/index.js:106-108`
- **Impact:** When `NODE_ENV !== 'production'`, any request can include `?custId=` to impersonate another user. This is trivially exploitable if the app runs with default settings.
- **Remediation:** Remove this code path entirely.

#### VULN-009: Silent Message Loss on Shipping Failure
- **Service:** shipping
- **File:** `ShippingController.postShipping()`
- **Impact:** If RabbitMQ is down, the shipping service catches the exception and returns `201 Created` anyway. The shipment is silently lost — no retry, no dead letter, no persistent fallback.
- **Remediation:** Return error to caller, or persist failed messages for retry.

#### VULN-010: Docker Socket Mount on Queue Master
- **Service:** queue-master (infrastructure)
- **Impact:** Queue Master mounts `/var/run/docker.sock` — giving it full Docker daemon access. A compromised queue-master container can escape to the host, launch arbitrary containers, and access all host resources.
- **Remediation:** Remove Docker socket mount. Use a proper container orchestrator for spawning tasks.

#### VULN-011: Hardcoded Database Credentials
- **Service:** catalogue
- **File:** `catalogue/cmd/cataloguesvc/main.go`
- **Impact:** MySQL credentials `catalogue_user:default_password` are hardcoded in the binary. The user is granted `ALL` privileges despite only needing `SELECT`.
- **Remediation:** Use environment variables or secrets. Grant minimum necessary privileges.

---

### MEDIUM

#### VULN-012: No Cookie Security Flags
- **Service:** front-end
- **Impact:** `logged_in` cookie missing `httpOnly` (vulnerable to XSS theft) and `secure` (sent over HTTP). `saveUninitialized: true` enables session fixation.

#### VULN-013: No Security Headers
- **Service:** front-end
- **Impact:** No Helmet.js or equivalent. Missing X-Frame-Options, CSP, X-XSS-Protection, HSTS.

#### VULN-014: No CORS Configuration
- **Service:** front-end
- **Impact:** Express permissive default — any origin can make requests.

#### VULN-015: Hardcoded RabbitMQ Credentials
- **Services:** shipping, queue-master
- **Impact:** `guest/guest` hardcoded in both services' RabbitMqConfiguration.

#### VULN-016: MySQL Empty Root Password
- **Service:** catalogue-db (infrastructure)
- **Impact:** `MYSQL_ALLOW_EMPTY_PASSWORD=true` — passwordless root access.

#### VULN-017: Grafana Default Admin Password
- **Service:** grafana (monitoring)
- **Impact:** Admin password is `foobar` — hardcoded in docker-compose.

#### VULN-018: Unenforced Input Validation (Carts)
- **Service:** carts
- **Impact:** `@NotNull` constraints on entities exist but `@Valid` is missing on controller parameters — constraints are never triggered.

---

### LOW

#### VULN-019: Error Stack Trace Leakage
- **Service:** front-end (`helpers/index.js:15-23`)
- **Impact:** Error handler returns full error object to client including stack traces.

#### VULN-020: `float32` for Currency
- **Service:** payment
- **Impact:** Floating-point precision issues with currency math.

#### VULN-021: Unbounded Page Size (Catalogue)
- **Service:** catalogue
- **Impact:** No upper limit on `size` query parameter — arbitrarily large responses.

#### VULN-022: Non-Durable RabbitMQ Queue
- **Service:** shipping/queue-master
- **Impact:** `shipping-task` queue is non-durable — all pending messages lost on RabbitMQ restart.

---

## Attack Surface Analysis

### Externally Exposed
- **edge-router** (ports 80, 8080) → front-end only
- All attacks from outside must go through the front-end gateway

### Internally Accessible (from any container)
- ALL services on the flat Docker network — no segmentation
- All databases (MySQL, MongoDB × 3, Redis, RabbitMQ)
- Docker socket (via queue-master)
- Prometheus, Grafana, Elasticsearch, Kibana

### Key Attack Vectors
1. **Session forgery** → impersonate any user (VULN-004)
2. **SSRF via orders** → access internal infrastructure (VULN-003)
3. **Direct service access** → bypass gateway, hit any backend (VULN-005)
4. **IDOR** → enumerate and access any user's data (VULN-006)
5. **Container escape** → via Docker socket on queue-master (VULN-010)

---

## Compliance Gaps

### PCI-DSS
- **Req 3:** Plaintext card numbers stored (VULN-001)
- **Req 4:** No TLS between services
- **Req 6:** No input validation, no secure coding practices
- **Req 7:** No access control — everyone can access everything
- **Req 8:** Shared/default credentials throughout

### GDPR
- User data (email, addresses) accessible without authentication
- No data deletion workflow (DELETE endpoints exist but no access control)
- No encryption at rest for personal data
- No audit logging of data access

---

## Remediation Priority Matrix

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| 1 | VULN-004: Session secret | Low | Critical — instant session forgery |
| 2 | VULN-005: Inter-service auth | High | Critical — complete internal access |
| 3 | VULN-003: SSRF in orders | Medium | Critical — internal network access |
| 4 | VULN-001: Card storage | Medium | Critical — PCI violation |
| 5 | VULN-002: SHA-1 passwords | Medium | Critical — offline brute-force |
| 6 | VULN-006: IDOR everywhere | Medium | High — cross-user data access |
| 7 | VULN-010: Docker socket | Low | High — container escape |
| 8 | VULN-008: Dev custId override | Low | High — trivial impersonation |
| 9 | VULN-009: Silent message loss | Medium | High — data integrity |
| 10 | VULN-011: Hardcoded DB creds | Low | High — credential exposure |
