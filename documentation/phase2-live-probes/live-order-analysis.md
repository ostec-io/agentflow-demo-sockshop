# Live Order Flow & Payment Analysis

**Date:** 2026-03-16
**Environment:** Sock Shop @ `http://localhost:8888`
**Method:** Direct API probing via curl

---

## 1. Order Volume

| Metric | Value |
|--------|-------|
| Total orders | 65 (pre-existing) + 1 (created during analysis) = **66** |
| Unique customers | **1** (`57a98d98e4b00679b4a830b2`, username: `user`) |
| Orders with items | 60 |
| Empty orders (shipping only) | 5 |
| Time range | All orders on 2026-03-16 (18:52 – 18:54 UTC batch, plus test order at 20:11 UTC) |

All existing orders belong to the same default customer ("User Name"), suggesting either load-test data or a single-user demo environment. Five orders contain zero items (total = $4.99 shipping only).

---

## 2. Revenue Analysis

| Metric | Value |
|--------|-------|
| Total revenue (65 pre-existing orders) | **$1,478.03** |
| Average order value | **$22.74** |
| Item subtotal (excl. shipping) | **$1,153.68** |
| Total shipping charges | **$324.35** |
| Shipping per order | **$4.99** (hardcoded) |
| Shipping verification | 65 x $4.99 = $324.35 — matches implied shipping total exactly |

### Order Value Distribution

| Range | Count | Notes |
|-------|-------|-------|
| $4.99 (empty) | 5 | Shipping-only, no items |
| $12.98 – $16.99 | 9 | Single low-price items ($7.99 – $12.00) |
| $18.99 – $22.99 | 28 | Single mid-price items ($14.00 – $18.00) |
| $23.97 – $34.99 | 23 | Two-item orders |

### Shipping Cost Verification

The Orders service hardcodes shipping at `$4.99` in `calculateTotal()`. Every order's total equals `sum(item.unitPrice * item.quantity) + 4.99`, confirmed across all 65 orders. The implied shipping total ($324.35) matches the expected total (65 x $4.99 = $324.35) exactly.

---

## 3. End-to-End Order Creation

### Successful Order

**Flow:** Login → Add to Cart → Place Order

```
Step 1: Login
  curl -s -X GET http://localhost:8888/login -c /tmp/order-cookie.txt --basic -u user:password
  Response: "Cookie is set"

Step 2: Add item to cart
  curl -s -X POST http://localhost:8888/cart -H 'Content-Type: application/json' \
    -d '{"id":"a0a4f044-b040-410d-8ead-4de0446aec7e","quantity":1}'
  Response: (success, no body)

Step 3: Place order
  curl -s -X POST http://localhost:8888/orders
  Response: 201 Created
```

**Order Response:**

```json
{
  "id": "69b863f627262d000744219d",
  "customerId": "57a98d98e4b00679b4a830b2",
  "customer": {
    "firstName": "User",
    "lastName": "Name",
    "username": "user"
  },
  "address": {
    "number": "246",
    "street": "Whitelees Road",
    "city": "Glasgow",
    "postcode": "G67 3DL",
    "country": "United Kingdom"
  },
  "card": {
    "longNum": "5544154011345918",
    "expires": "08/19",
    "ccv": "958"
  },
  "items": [
    {
      "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
      "quantity": 1,
      "unitPrice": 7.99
    }
  ],
  "shipment": {
    "id": "bfe25f4a-ab5c-4cc7-997c-a1a9cc858dca",
    "name": "57a98d98e4b00679b4a830b2"
  },
  "date": "2026-03-16T20:11:34.375+0000",
  "total": 12.98
}
```

**Total breakdown:** $7.99 (item) + $4.99 (shipping) = **$12.98** — correct.

The order creation flow works end-to-end: the Orders service successfully orchestrated calls to User, Cart, Payment, and Shipping services, then persisted the order to MongoDB.

---

## 4. Payment Authorization

### Successful Payment (amount under threshold)

The order above ($12.98 total) was authorized by the Payment service without issue. The Payment service approves amounts up to its configured decline threshold.

### Declined Payment (amount over threshold)

**Test:** Added item `03fef6ac-1896-4ce8-bd69-b798f85c6e0b` (Holy, $99.99) to cart and attempted order.

```json
{
  "timestamp": 1773691900788,
  "status": 406,
  "error": "Not Acceptable",
  "exception": "works.weave.socks.orders.controllers.OrdersController$PaymentDeclinedException",
  "message": "Payment declined: amount exceeds 100.00",
  "path": "/orders"
}
```

**Observations:**
- The Payment service decline threshold is set to **$100.00** on this instance (default is $105.00 per source code, but this deployment uses $100.00).
- Item ($99.99) + shipping ($4.99) = $104.98, which exceeds $100.00.
- The Orders service correctly translates a `PaymentDeclinedException` into HTTP 406 Not Acceptable.
- The decline message includes the threshold amount, confirming the Payment service's response is propagated to the client.

### Payment Authorization Flow

```
Client → POST /orders → Orders Service
  Orders Service → POST /paymentAuth → Payment Service
    Payment Service evaluates: amount <= threshold?
      YES → { "authorised": true, "message": "Payment authorised" }
      NO  → { "authorised": false, "message": "Payment declined: amount exceeds 100.00" }
  Orders Service checks authorised field:
    true  → proceed to shipping + save
    false → throw PaymentDeclinedException → 406 to client
```

---

## 5. Health Status

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /orders/health` | **404 Not Found** | Endpoint not exposed through the Traefik gateway. The orders service runs on port 8082 internally but the `/health` path is not routed at the gateway level. |
| `GET /payment/health` | **Cannot GET** | Payment service health endpoint not routed through the gateway (`/payment/health` is not a configured route). |

**Note:** Health endpoints are available on the internal service ports (orders:8082/health, payment:8080/health) but are not exposed through the Traefik API gateway at `localhost:8888`. This is expected — health checks are typically consumed by orchestrators (Docker/Kubernetes) rather than external clients.

---

## 6. Individual Order Detail

**GET /orders/69b8516227262d000744215c** (first order in the system):

```json
{
  "customerId": "57a98d98e4b00679b4a830b2",
  "customer": { "firstName": "User", "lastName": "Name", "username": "user" },
  "address": { "number": "246", "street": "Whitelees Road", "city": "Glasgow", "postcode": "G67 3DL", "country": "United Kingdom" },
  "card": { "longNum": "5544154011345918", "expires": "08/19", "ccv": "958" },
  "items": [{ "itemId": "808a2de1-1aaa-4c25-a9b9-6612e8f29a38", "quantity": 1, "unitPrice": 17.32 }],
  "shipment": { "name": "57a98d98e4b00679b4a830b2" },
  "date": "2026-03-16T18:52:18.253+0000",
  "total": 22.31
}
```

The order document embeds full snapshots of customer, address, card, and item data as expected from the service profile. Card details (full number, CCV) are stored in plaintext — consistent with the known security finding.

---

## 7. Key Findings

1. **Order system is fully functional** — end-to-end order creation (login → cart → order) works correctly through the API gateway.
2. **Payment threshold is $100.00** — lower than the default $105.00 in source code, indicating custom deployment configuration.
3. **Shipping cost verified** — $4.99 flat rate confirmed across all 65+ orders.
4. **Single customer** — all orders belong to one customer, consistent with a demo/test environment.
5. **Duplicate orders present** — many orders appear in pairs with identical timestamps, suggesting concurrent request handling or load test behavior.
6. **Empty orders exist** — 5 orders with $4.99 total (no items), indicating the system allows ordering with an empty cart.
7. **Health endpoints not gateway-routed** — `/orders/health` and `/payment/health` return 404 through Traefik, available only on internal service ports.
8. **Sensitive data in responses** — full card numbers and CCV values are returned in order detail responses (known security issue per service profile).
