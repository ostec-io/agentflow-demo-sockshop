# Sock Shop Customer Intelligence

Live customer intelligence report generated from `http://localhost:8888` on `2026-03-17`.

## Data Collection

| Dataset | Command | Output |
|---|---|---|
| Customers | `curl -s http://localhost:8888/customers` | `/tmp/sock-shop-customers-cs.json` |
| Cards | `curl -s http://localhost:8888/cards` | `/tmp/sock-shop-cards-cs.json` |
| Addresses | `curl -s http://localhost:8888/addresses` | `/tmp/sock-shop-addresses-cs.json` |
| Orders | `curl -s -c /tmp/cs-cookie.txt -b /tmp/cs-cookie.txt http://localhost:8888/login --basic -u user:password` then `curl -s -b /tmp/cs-cookie.txt http://localhost:8888/orders` | `/tmp/sock-shop-orders-cs.json` |
| Catalogue | `curl -s http://localhost:8888/catalogue` | `/tmp/sock-shop-catalogue-cs.json` |

## Source Constraints

- `GET /customers`, `GET /cards`, and `GET /addresses` are public collection endpoints.
- `GET /customers/{id}/addresses` and `GET /customers/{id}/cards` are not routed through `localhost:8888`. To pull owned customer data live, the session-scoped gateway routes `GET /customers/{id}`, `GET /address`, and `GET /card` were used after authenticating as each customer.
- `GET /orders` is session-scoped. In the current live environment, only `user` returns orders. `Eve_Berger`, `user1`, `testprobe`, and `testprobe_1773691909` each returned an empty order list when queried with their own valid login session.
- Email addresses and explicit account-created timestamps are not exposed by the live gateway responses, so those fields are recorded as not available.
- The public collections still expose one orphaned address record (`57a98ddce4b00679b4a830d1`) and one orphaned card record (`57a98ddce4b00679b4a830d2`) that are not linked to any current visible customer profile.

## Customer Profiles

### Customer: Eve Berger (@Eve_Berger)

- Customer ID: `57a98d98e4b00679b4a830af`
- Email: not exposed by live API
- Account created: not exposed by live API

**Addresses on file**

- `57a98d98e4b00679b4a830ad` — 246 Whitelees Road, Glasgow, G67 3DL, United Kingdom
- Shared-address note: same street, city, postcode, and country as `user`, but stored under a different address ID

**Payment methods on file**

- `****9678` — expires `08/19`, expired as of March 2026, fails a basic Luhn checksum

**Order History**

- Total orders: `0`
- Total spend: `$0.00`
- Average order value: `$0.00`
- First order date: none returned
- Most recent order date: none returned
- Most ordered products: none returned
- Largest single order: `$0.00`
- Smallest single order: `$0.00`

**Customer Segment**

- `Dormant`

**Loyalty Score**

- `2/10`

### Customer: User Name (@user)

- Customer ID: `57a98d98e4b00679b4a830b2`
- Email: not exposed by live API
- Account created: not exposed by live API

**Addresses on file**

- `57a98d98e4b00679b4a830b0` — 246 Whitelees Road, Glasgow, G67 3DL, United Kingdom
- Shared-address note: same street, city, postcode, and country as `Eve_Berger`, but stored under a different address ID

**Payment methods on file**

- `****5918` — expires `08/19`, expired as of March 2026, fails a basic Luhn checksum

**Order History**

- Total orders: `66`
- Total spend: `$1491.01`
- Average order value: `$22.59`
- First order date: `2026-03-16T18:52:18.253+0000`
- Most recent order date: `2026-03-16T20:11:34.375+0000`
- Most ordered products: `SuperSport XL (14)`, `Crossed (12)`, `Classic (12)`
- Largest single order: `$34.99` (`69b8516327262d000744215e`)
- Smallest single order: `$4.99` (`69b851f527262d0007442170`)

**Customer Segment**

- `VIP`

**Loyalty Score**

- `10/10`

### Customer: User1 Name1 (@user1)

- Customer ID: `57a98d98e4b00679b4a830b5`
- Email: not exposed by live API
- Account created: not exposed by live API

**Addresses on file**

- `57a98d98e4b00679b4a830b3` — 4 Maes-Y-Deri, Aberdare, CF44 6TF, United Kingdom
- Shared-address note: no shared address detected in the live collections

**Payment methods on file**

- `****5205` — expires `08/19`, expired as of March 2026, fails a basic Luhn checksum

**Order History**

- Total orders: `0`
- Total spend: `$0.00`
- Average order value: `$0.00`
- First order date: none returned
- Most recent order date: none returned
- Most ordered products: none returned
- Largest single order: `$0.00`
- Smallest single order: `$0.00`

**Customer Segment**

- `Dormant`

**Loyalty Score**

- `2/10`

### Customer: Test Probe (@testprobe)

- Customer ID: `69b863d2ee11cb0001112184`
- Email: not exposed by live API
- Account created: not exposed by live API

**Addresses on file**

- none returned by `GET /address`

**Payment methods on file**

- none returned by `GET /card`

**Order History**

- Total orders: `0`
- Total spend: `$0.00`
- Average order value: `$0.00`
- First order date: none returned
- Most recent order date: none returned
- Most ordered products: none returned
- Largest single order: `$0.00`
- Smallest single order: `$0.00`

**Customer Segment**

- `New`

**Loyalty Score**

- `1/10`

### Customer: Test Probe (@testprobe_1773691909)

- Customer ID: `69b86405ee11cb0001112186`
- Email: not exposed by live API
- Account created: not exposed by live API

**Addresses on file**

- none returned by `GET /address`

**Payment methods on file**

- none returned by `GET /card`

**Order History**

- Total orders: `0`
- Total spend: `$0.00`
- Average order value: `$0.00`
- First order date: none returned
- Most recent order date: none returned
- Most ordered products: none returned
- Largest single order: `$0.00`
- Smallest single order: `$0.00`

**Customer Segment**

- `New`

**Loyalty Score**

- `1/10`

## Simulated Customer Service Interactions

### Scenario 1: "Where is my latest order?"

**Customer question**

> Hi, I'm user. Can you tell me the status of my most recent order?

**API calls**

```bash
curl -s -c /tmp/scenario-user.cookie -b /tmp/scenario-user.cookie http://localhost:8888/login --basic -u user:password
curl -s -b /tmp/scenario-user.cookie http://localhost:8888/orders | python3 -m json.tool
```

**Real response excerpt**

```json
{
  "date": "2026-03-16T20:11:34.375+0000",
  "total": 12.98,
  "shipment": {
    "name": "57a98d98e4b00679b4a830b2"
  },
  "items": [
    {
      "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
      "quantity": 1,
      "unitPrice": 7.99
    }
  ],
  "_links": {
    "self": {
      "href": "http://orders/orders/69b863f627262d000744219d"
    }
  }
}
```

**AI agent response**

Your most recent order is `69b863f627262d000744219d`, placed on `2026-03-16T20:11:34.375+0000`. It contains `1 x Nerd leg` and the order total is `$12.98`. The shipment reference in the live response is `57a98d98e4b00679b4a830b2`. The current orders API does not expose a delivery-status field, so I can confirm the latest order and shipment reference, but not a carrier status from this gateway route.

### Scenario 2: "What's my total spend?"

**Customer question**

> How much have I spent in total on your store?

**API calls**

```bash
curl -s -c /tmp/scenario-user.cookie -b /tmp/scenario-user.cookie http://localhost:8888/login --basic -u user:password
curl -s -b /tmp/scenario-user.cookie http://localhost:8888/orders | python3 -m json.tool
```

**Real response evidence**

- `GET /orders` returned `66` order objects for `user`
- Summing the returned `total` fields gives `$1491.01`
- The mean order value across the same `66` live orders is `$22.59`

**AI agent response**

Across your current live order history, you have spent `$1491.01` with us over `66` orders. Your average order value is `$22.59`, your first visible order in this dataset was on `2026-03-16T18:52:18.253+0000`, and your most recent order was on `2026-03-16T20:11:34.375+0000`.

### Scenario 3: "Do you have any formal socks in stock?"

**Customer question**

> I need some formal socks for a wedding. What do you have?

**API calls**

```bash
curl -s 'http://localhost:8888/catalogue?tags=formal' | python3 -m json.tool
```

**Real response excerpt**

```json
[
  { "name": "SuperSport XL", "price": 15, "count": 820 },
  { "name": "Crossed", "price": 17.32, "count": 738 },
  { "name": "Figueroa", "price": 14, "count": 808 },
  { "name": "Cat socks", "price": 15, "count": 175 },
  { "name": "YouTube.sock", "price": 10.99, "count": 801 }
]
```

**AI agent response**

Yes. The live catalogue currently shows five formal-tagged options in stock: `YouTube.sock` at `$10.99` with `801` units, `Figueroa` at `$14.00` with `808` units, `Cat socks` at `$15.00` with `175` units, `SuperSport XL` at `$15.00` with `820` units, and `Crossed` at `$17.32` with `738` units. If you want the cheapest formal option, `YouTube.sock` is the best fit from the current stock.

### Scenario 4: "Why was my payment declined?"

**Customer question**

> I tried to order the Holy socks but my payment was declined. Why?

**API calls**

```bash
curl -s http://localhost:8888/catalogue | python3 -m json.tool
```

**Real response excerpt**

```json
{
  "id": "03fef6ac-1896-4ce8-bd69-b798f85c6e0b",
  "name": "Holy",
  "price": 99.99,
  "count": 1,
  "tag": [
    "magic",
    "action"
  ]
}
```

**AI agent response**

The live catalogue shows `Holy` priced at `$99.99` and there is only `1` unit left. Using the current observed shipping charge of `$4.99`, that basket totals `$104.98`. If your checkout environment is enforcing a `$100` payment cap, that total would explain the decline. To stay safely under that limit, current alternatives include `YouTube.sock` at `$10.99`, `Figueroa` at `$14.00`, `SuperSport XL` at `$15.00`, and `Crossed` at `$17.32`.

**Analyst note**

- The gateway confirms the `Holy` price, but it does not expose a payment-policy endpoint.
- The `$4.99` shipping component is consistent with six shipping-only orders in the live `/orders` data.
- Repo documentation is inconsistent on the exact payment-decline threshold, so the live customer-service answer can confirm basket math but not prove the internal policy through `localhost:8888` alone.

### Scenario 5: "What's your cheapest sock?"

**Customer question**

> I'm on a budget. What's the cheapest pair you have?

**API calls**

```bash
curl -s http://localhost:8888/catalogue | python3 -m json.tool
```

**Real response excerpt**

```json
{
  "id": "a0a4f044-b040-410d-8ead-4de0446aec7e",
  "name": "Nerd leg",
  "price": 7.99,
  "count": 115,
  "description": "For all those leg lovers out there. A perfect example of a swivel chair trained calf. Meticulously trained on a diet of sitting and Pina Coladas. Phwarr..."
}
```

**AI agent response**

The cheapest pair in the live catalogue right now is `Nerd leg` at `$7.99`, and there are `115` units in stock. Its description is: "For all those leg lovers out there. A perfect example of a swivel chair trained calf. Meticulously trained on a diet of sitting and Pina Coladas. Phwarr..."

## Customer Intelligence Summary

### Portfolio Metrics

| Metric | Live Result |
|---|---|
| Total customers in system | `5` |
| Customers with any orders | `1` |
| Total visible revenue | `$1491.01` |
| Revenue concentration | `100.00%` of visible revenue comes from `user` |
| Average customer lifetime value | `$298.20` across all `5` visible customers |

### Customer Health Indicators

- `3/3` stored customer cards are expired as of March 2026 and all three fail a basic Luhn checksum.
- `4/5` customers have no live order history.
- `2/5` customers have no stored address and no stored card (`testprobe`, `testprobe_1773691909`).
- `2/5` customers share the same physical address footprint (`Eve_Berger`, `user`).
- The public collections contain one orphaned address (`57a98ddce4b00679b4a830d1`) and one orphaned card (`57a98ddce4b00679b4a830d2`), which suggests stale demo data or incomplete cleanup.

### Segment Mix

| Segment | Customers |
|---|---|
| VIP | `user` |
| Dormant | `Eve_Berger`, `user1` |
| New | `testprobe`, `testprobe_1773691909` |

### Recommendations

- Protect the single high-value account: `user` currently generates all visible revenue and should be targeted for retention, replenishment reminders, and premium offers.
- Run win-back outreach for `Eve_Berger` and `user1`: both have saved profiles but no current orders, which makes them the clearest dormant reactivation candidates.
- Force payment-profile refresh: every visible saved card is expired, so checkout friction is likely if these customers attempt to convert.
- Convert the two `testprobe` accounts fast or purge them: they look like fresh test or trial registrations with no saved profile data and no orders.
- Clean orphaned customer records from the user service collections to reduce ambiguity in downstream analytics and service tooling.
