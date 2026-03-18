# Live Anomaly Detection Demonstration

Generated from live API interactions against `http://localhost:8888` on 2026-03-17.

## Context and Baseline

This demonstration builds on two Sprint 1 intelligence reports:

- `documentation/intel-fraud-detection.md`
- `documentation/intel-order-patterns.md`

Baseline facts carried into this live run:

- Historical order count before this demo: `66`
- Historical maximum observed order total: `$34.99`
- Historical average basket size: `1.26` items
- Historical basket distribution: `6` empty, `37` single-item, `23` two-item orders
- Historical near-threshold orders (`$90-$100`): `0`
- Historical orders containing `Holy`: `0`
- Historical activity concentration: all observed spend came from `user`

Pre-demo verification against the live API confirmed the baseline still held immediately before scenario execution:

- `GET /catalogue` still returned the expected 9 SKUs, including `Holy` at `$99.99`
- `GET /orders` still returned `66` orders
- The latest pre-demo order timestamp remained `2026-03-16T20:11:34.375+0000`

The goal of this report is to create fresh live orders and analyze them in real time against that baseline.

## Scenario 1: Normal Small Order (Baseline Transaction)

Narration: "We'll start with a perfectly normal transaction — a single low-value item."

### Raw execution

```text
LOGIN
Cookie is set

CART_BEFORE
[]

DELETE_CART
HTTP Status: 202

CART_CLEARED
[]

ADD_RESPONSE
HTTP Status: 201

CART_AFTER_ADD
[
    {
        "id": "69b9b990a027950007fa8e85",
        "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
        "quantity": 1,
        "unitPrice": 7.99
    }
]

ORDER_RESPONSE
{
    "id": "69b9b99127262d000744219e",
    "customerId": "57a98d98e4b00679b4a830b2",
    "customer": {
        "id": null,
        "firstName": "User",
        "lastName": "Name",
        "username": "user",
        "addresses": [],
        "cards": []
    },
    "address": {
        "id": null,
        "number": "246",
        "street": "Whitelees Road",
        "city": "Glasgow",
        "postcode": "G67 3DL",
        "country": "United Kingdom"
    },
    "card": {
        "id": null,
        "longNum": "5544154011345918",
        "expires": "08/19",
        "ccv": "958"
    },
    "items": [
        {
            "id": "69b9b990a027950007fa8e85",
            "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
            "quantity": 1,
            "unitPrice": 7.99
        }
    ],
    "shipment": {
        "id": "7cf0e27c-b1e3-4650-8731-f35352f55913",
        "name": "57a98d98e4b00679b4a830b2"
    },
    "date": "2026-03-17T20:29:05.645+0000",
    "total": 12.98
}
```

### Real-time analysis

- Outcome: approved
- Order ID: `69b9b99127262d000744219e`
- Timestamp: `2026-03-17T20:29:05.645+0000`
- Basket shape: `1` item
- Total: `$12.98` (`$7.99` merchandise + `$4.99` shipping)
- Risk posture: low

This is the expected control case. The order is well below the `$100.00` payment threshold, contains one low-cost SKU, and matches the most common historical order pattern: a single-item basket.

### Comparison to Sprint 1 baseline

- The live basket size of `1` aligns with the historical mode of `37` single-item orders.
- The total of `$12.98` sits below the historical average order value of `$22.59`.
- This does not resemble the previously observed automation bursts because it is a single isolated checkout rather than one of many sub-second repeats.

## Scenario 2: High-Value Order Near Threshold (Suspicious Pattern)

Narration: "Now let's create a higher-value order that approaches the $100 payment limit. This is the kind of transaction a fraud system should flag for review."

### Raw execution

```text
LOGIN
Cookie is set

CART_BEFORE
[
    {
        "id": "69b9b990a027950007fa8e85",
        "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
        "quantity": 1,
        "unitPrice": 7.99
    }
]

DELETE_CART
HTTP Status: 202

CART_CLEARED
[]

ADD_RESPONSE_1
HTTP Status: 201

ADD_RESPONSE_2
HTTP Status: 201

ADD_RESPONSE_3
HTTP Status: 201

ADD_RESPONSE_4
HTTP Status: 201

ADD_RESPONSE_5
HTTP Status: 201

CART_AFTER_ADD
[
    {
        "id": "69b9b9bfa027950007fa8e88",
        "itemId": "3395a43e-2d88-40de-b95f-e00e1502085b",
        "quantity": 1,
        "unitPrice": 18.0
    },
    {
        "id": "69b9b9bfa027950007fa8e89",
        "itemId": "808a2de1-1aaa-4c25-a9b9-6612e8f29a38",
        "quantity": 1,
        "unitPrice": 17.32
    },
    {
        "id": "69b9b9bfa027950007fa8e8a",
        "itemId": "510a0d7e-8e83-4193-b483-e27e09ddc34d",
        "quantity": 1,
        "unitPrice": 15.0
    },
    {
        "id": "69b9b9bfa027950007fa8e8b",
        "itemId": "837ab141-399e-4c1f-9abc-bace40296bac",
        "quantity": 1,
        "unitPrice": 15.0
    },
    {
        "id": "69b9b9bfa027950007fa8e8c",
        "itemId": "819e1fbf-8b7e-4f6d-811f-693534916a8b",
        "quantity": 1,
        "unitPrice": 14.0
    }
]

ORDER_RESPONSE
{
    "id": "69b9b9c027262d000744219f",
    "customerId": "57a98d98e4b00679b4a830b2",
    "customer": {
        "id": null,
        "firstName": "User",
        "lastName": "Name",
        "username": "user",
        "addresses": [],
        "cards": []
    },
    "address": {
        "id": null,
        "number": "246",
        "street": "Whitelees Road",
        "city": "Glasgow",
        "postcode": "G67 3DL",
        "country": "United Kingdom"
    },
    "card": {
        "id": null,
        "longNum": "5544154011345918",
        "expires": "08/19",
        "ccv": "958"
    },
    "items": [
        {
            "id": "69b9b9bfa027950007fa8e88",
            "itemId": "3395a43e-2d88-40de-b95f-e00e1502085b",
            "quantity": 1,
            "unitPrice": 18
        },
        {
            "id": "69b9b9bfa027950007fa8e89",
            "itemId": "808a2de1-1aaa-4c25-a9b9-6612e8f29a38",
            "quantity": 1,
            "unitPrice": 17.32
        },
        {
            "id": "69b9b9bfa027950007fa8e8a",
            "itemId": "510a0d7e-8e83-4193-b483-e27e09ddc34d",
            "quantity": 1,
            "unitPrice": 15
        },
        {
            "id": "69b9b9bfa027950007fa8e8b",
            "itemId": "837ab141-399e-4c1f-9abc-bace40296bac",
            "quantity": 1,
            "unitPrice": 15
        },
        {
            "id": "69b9b9bfa027950007fa8e8c",
            "itemId": "819e1fbf-8b7e-4f6d-811f-693534916a8b",
            "quantity": 1,
            "unitPrice": 14
        }
    ],
    "shipment": {
        "id": "e3b079b8-e6b7-4680-8cd2-e0dd8a93420d",
        "name": "57a98d98e4b00679b4a830b2"
    },
    "date": "2026-03-17T20:29:52.369+0000",
    "total": 84.31
}
```

### Real-time analysis

- Outcome: approved
- Order ID: `69b9b9c027262d000744219f`
- Timestamp: `2026-03-17T20:29:52.369+0000`
- Basket shape: `5` items
- Total: `$84.31`
- Distance from payment cutoff: `$15.69`
- Risk posture: elevated and review-worthy

This order succeeded, but it should not blend into the background. The basket is unusually deep for this environment, the spend level is far above normal historical traffic, and the item mix spans multiple catalogue segments in a single checkout.

### Comparison to Sprint 1 baseline

- Historical maximum basket depth was `2` items; this live basket contains `5`.
- Historical maximum observed order total was `$34.99`; this live order is `2.41x` larger at `$84.31`.
- Sprint 1 observed `0` orders in the `$50-$90` band and `0` in the `$90-$100` danger zone, so this order establishes a new near-threshold pattern.
- Historical traffic was dominated by repeated simple baskets; this order is more consistent with manual basket shaping or threshold probing than with the seeded replay patterns.

## Scenario 3: The Unpurchasable Product (Threshold Breach)

Narration: "Now for the key demo moment. We'll try to purchase the 'Holy' sock — the most expensive item at $99.99. With $4.99 shipping, the total is $104.98 — which exceeds the $100 payment threshold."

### Raw execution

```text
LOGIN
Cookie is set

CART_BEFORE
[
    {
        "id": "69b9b9bfa027950007fa8e88",
        "itemId": "3395a43e-2d88-40de-b95f-e00e1502085b",
        "quantity": 1,
        "unitPrice": 18.0
    },
    {
        "id": "69b9b9bfa027950007fa8e89",
        "itemId": "808a2de1-1aaa-4c25-a9b9-6612e8f29a38",
        "quantity": 1,
        "unitPrice": 17.32
    },
    {
        "id": "69b9b9bfa027950007fa8e8a",
        "itemId": "510a0d7e-8e83-4193-b483-e27e09ddc34d",
        "quantity": 1,
        "unitPrice": 15.0
    },
    {
        "id": "69b9b9bfa027950007fa8e8b",
        "itemId": "837ab141-399e-4c1f-9abc-bace40296bac",
        "quantity": 1,
        "unitPrice": 15.0
    },
    {
        "id": "69b9b9bfa027950007fa8e8c",
        "itemId": "819e1fbf-8b7e-4f6d-811f-693534916a8b",
        "quantity": 1,
        "unitPrice": 14.0
    }
]

DELETE_CART
HTTP Status: 202

CART_CLEARED
[]

ADD_RESPONSE
HTTP Status: 201

CART_AFTER_ADD
[
    {
        "id": "69b9b9f7a027950007fa8e8f",
        "itemId": "03fef6ac-1896-4ce8-bd69-b798f85c6e0b",
        "quantity": 1,
        "unitPrice": 99.99
    }
]

ORDER_RESPONSE_BODY
{
    "timestamp": 1773779447758,
    "status": 406,
    "error": "Not Acceptable",
    "exception": "works.weave.socks.orders.controllers.OrdersController$PaymentDeclinedException",
    "message": "Payment declined: amount exceeds 100.00",
    "path": "/orders"
}

ORDER_RESPONSE_STATUS
HTTP Status: 406
```

### Real-time analysis

- Outcome: declined
- SKU: `Holy`
- Computed total: `$104.98`
- Response status: `406`
- Response message: `Payment declined: amount exceeds 100.00`
- Risk posture: business-rule breach, not fraud per se

This is the live confirmation of the "Holy Sock Paradox." The product is present in the catalogue, has inventory, and can be added to cart, but checkout is mathematically impossible because `99.99 + 4.99 = 104.98`, which breaches the hard payment cutoff.

This insight was first surfaced by the Inventory Intelligence work in Sprint 1. The live checkout attempt confirms it end to end across catalogue pricing, cart composition, shipping rules, and payment validation.

### Comparison to Sprint 1 baseline

- Sprint 1 observed `0` orders containing `Holy`; this live decline explains why.
- Historical order totals never exceeded `$34.99`; the first attempted order over `$100` was rejected immediately.
- This is a true cross-domain finding: catalogue price + flat shipping + payment threshold combine to create dead inventory that cannot convert into revenue.

## Scenario 4: Rapid-Fire Orders (Velocity Anomaly)

Narration: "Finally, let's simulate what rapid automated ordering looks like — placing multiple orders in quick succession. A fraud system should detect this velocity anomaly."

### Raw execution

```text
LOGIN
Cookie is set

CART_BEFORE
[
    {
        "id": "69b9b9f7a027950007fa8e8f",
        "itemId": "03fef6ac-1896-4ce8-bd69-b798f85c6e0b",
        "quantity": 1,
        "unitPrice": 99.99
    }
]

DELETE_CART
HTTP Status: 202

CART_CLEARED
[]

ADD_RESPONSE_1
HTTP Status: 201
ORDER_RESPONSE_1
{
    "id": "69b9ba2527262d00074421a0",
    "customerId": "57a98d98e4b00679b4a830b2",
    "customer": {
        "id": null,
        "firstName": "User",
        "lastName": "Name",
        "username": "user",
        "addresses": [],
        "cards": []
    },
    "address": {
        "id": null,
        "number": "246",
        "street": "Whitelees Road",
        "city": "Glasgow",
        "postcode": "G67 3DL",
        "country": "United Kingdom"
    },
    "card": {
        "id": null,
        "longNum": "5544154011345918",
        "expires": "08/19",
        "ccv": "958"
    },
    "items": [
        {
            "id": "69b9ba24a027950007fa8e92",
            "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
            "quantity": 1,
            "unitPrice": 7.99
        }
    ],
    "shipment": {
        "id": "115b1c1c-d597-4a15-acc5-2842fd3d45d9",
        "name": "57a98d98e4b00679b4a830b2"
    },
    "date": "2026-03-17T20:31:33.006+0000",
    "total": 12.98
}

ADD_RESPONSE_2
HTTP Status: 201
ORDER_RESPONSE_2
{
    "id": "69b9ba2527262d00074421a1",
    "customerId": "57a98d98e4b00679b4a830b2",
    "customer": {
        "id": null,
        "firstName": "User",
        "lastName": "Name",
        "username": "user",
        "addresses": [],
        "cards": []
    },
    "address": {
        "id": null,
        "number": "246",
        "street": "Whitelees Road",
        "city": "Glasgow",
        "postcode": "G67 3DL",
        "country": "United Kingdom"
    },
    "card": {
        "id": null,
        "longNum": "5544154011345918",
        "expires": "08/19",
        "ccv": "958"
    },
    "items": [
        {
            "id": "69b9ba24a027950007fa8e92",
            "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
            "quantity": 2,
            "unitPrice": 7.99
        }
    ],
    "shipment": {
        "id": "900633f4-0b47-4a29-a73a-50a5ae8ccdf0",
        "name": "57a98d98e4b00679b4a830b2"
    },
    "date": "2026-03-17T20:31:33.289+0000",
    "total": 20.97
}

ADD_RESPONSE_3
HTTP Status: 201
ORDER_RESPONSE_3
{
    "id": "69b9ba2527262d00074421a2",
    "customerId": "57a98d98e4b00679b4a830b2",
    "customer": {
        "id": null,
        "firstName": "User",
        "lastName": "Name",
        "username": "user",
        "addresses": [],
        "cards": []
    },
    "address": {
        "id": null,
        "number": "246",
        "street": "Whitelees Road",
        "city": "Glasgow",
        "postcode": "G67 3DL",
        "country": "United Kingdom"
    },
    "card": {
        "id": null,
        "longNum": "5544154011345918",
        "expires": "08/19",
        "ccv": "958"
    },
    "items": [
        {
            "id": "69b9ba24a027950007fa8e92",
            "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
            "quantity": 3,
            "unitPrice": 7.99
        }
    ],
    "shipment": {
        "id": "66bb0234-2dd0-433a-b4b4-8ca1a8d9b656",
        "name": "57a98d98e4b00679b4a830b2"
    },
    "date": "2026-03-17T20:31:33.455+0000",
    "total": 28.96
}

CART_AFTER_RUN
[
    {
        "id": "69b9ba24a027950007fa8e92",
        "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
        "quantity": 3,
        "unitPrice": 7.99
    }
]

ORDER_TIMING_SUMMARY
order_1 id=69b9ba2527262d00074421a0 date=2026-03-17T20:31:33.006+0000 total=12.98
order_2 id=69b9ba2527262d00074421a1 date=2026-03-17T20:31:33.289+0000 total=20.97
order_3 id=69b9ba2527262d00074421a2 date=2026-03-17T20:31:33.455+0000 total=28.96
gap_1_2_seconds=0.283
gap_2_3_seconds=0.166
```

### Real-time analysis

- Outcome: all `3` orders approved
- Timing gaps: `0.283s` and `0.166s`
- Same account: `user`
- Same SKU family: repeated `Nerd leg`
- Risk posture: strong velocity anomaly

The velocity signal is clear: three successful orders landed within the same second. That matches the automation-like timing profile from Sprint 1.

The live run also surfaced an additional state-management issue: `POST /orders` did not clear the cart. Each subsequent `POST /cart` incremented the existing `Nerd leg` line item from quantity `1` to `2` to `3`, so the three rapid-fire orders escalated from `$12.98` to `$20.97` to `$28.96`. After the sequence, the cart still contained quantity `3`.

That means a real detector should flag two things at once:

- velocity: multiple checkouts from the same account within sub-second intervals
- state anomaly: checkout is not consuming the cart, which enables accidental or automated replay with growing totals

### Comparison to Sprint 1 baseline

- Sprint 1 already showed `59` inter-order gaps under `1` second; this live run reproduces that pattern directly.
- The two measured gaps here are both faster than one second and therefore consistent with the historical burst profile.
- Historical repeat patterns often involved identical timestamps and repeated baskets. This live run is slightly different: the timestamps are distinct but still sub-second, and the basket mutates because the cart persists across checkout.

## Scenario 5: Post-Demo Verification

### Raw execution

```text
order_count=71
demo_order_presence
scenario1 69b9b99127262d000744219e 2026-03-17T20:29:05.645+0000 total=12.98 items=a0a4f044-b040-410d-8ead-4de0446aec7ex1
scenario2 69b9b9c027262d000744219f 2026-03-17T20:29:52.369+0000 total=84.31 items=3395a43e-2d88-40de-b95f-e00e1502085bx1, 808a2de1-1aaa-4c25-a9b9-6612e8f29a38x1, 510a0d7e-8e83-4193-b483-e27e09ddc34dx1, 837ab141-399e-4c1f-9abc-bace40296bacx1, 819e1fbf-8b7e-4f6d-811f-693534916a8bx1
scenario4_1 69b9ba2527262d00074421a0 2026-03-17T20:31:33.006+0000 total=12.98 items=a0a4f044-b040-410d-8ead-4de0446aec7ex1
scenario4_2 69b9ba2527262d00074421a1 2026-03-17T20:31:33.289+0000 total=20.97 items=a0a4f044-b040-410d-8ead-4de0446aec7ex2
scenario4_3 69b9ba2527262d00074421a2 2026-03-17T20:31:33.455+0000 total=28.96 items=a0a4f044-b040-410d-8ead-4de0446aec7ex3
latest_orders
2026-03-17T20:31:33.455+0000 69b9ba2527262d00074421a2 total=28.96 items=a0a4f044-b040-410d-8ead-4de0446aec7ex3
2026-03-17T20:31:33.289+0000 69b9ba2527262d00074421a1 total=20.97 items=a0a4f044-b040-410d-8ead-4de0446aec7ex2
2026-03-17T20:31:33.006+0000 69b9ba2527262d00074421a0 total=12.98 items=a0a4f044-b040-410d-8ead-4de0446aec7ex1
2026-03-17T20:29:52.369+0000 69b9b9c027262d000744219f total=84.31 items=3395a43e-2d88-40de-b95f-e00e1502085bx1, 808a2de1-1aaa-4c25-a9b9-6612e8f29a38x1, 510a0d7e-8e83-4193-b483-e27e09ddc34dx1, 837ab141-399e-4c1f-9abc-bace40296bacx1, 819e1fbf-8b7e-4f6d-811f-693534916a8bx1
2026-03-17T20:29:05.645+0000 69b9b99127262d000744219e total=12.98 items=a0a4f044-b040-410d-8ead-4de0446aec7ex1
2026-03-16T20:11:34.375+0000 69b863f627262d000744219d total=12.98 items=a0a4f044-b040-410d-8ead-4de0446aec7ex1

ORDERS_TAIL
        "date": "2026-03-17T20:31:33.006+0000",
        "total": 12.98,
        "_links": {
            "self": {
                "href": "http://orders/orders/69b9ba2527262d00074421a0"
            },
            "order": {
                "href": "http://orders/orders/69b9ba2527262d00074421a0"
            }
        }
    },
    {
        "customerId": "57a98d98e4b00679b4a830b2",
        "items": [
            {
                "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
                "quantity": 2,
                "unitPrice": 7.99
            }
        ],
        "date": "2026-03-17T20:31:33.289+0000",
        "total": 20.97,
        "_links": {
            "self": {
                "href": "http://orders/orders/69b9ba2527262d00074421a1"
            },
            "order": {
                "href": "http://orders/orders/69b9ba2527262d00074421a1"
            }
        }
    },
    {
        "customerId": "57a98d98e4b00679b4a830b2",
        "items": [
            {
                "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
                "quantity": 3,
                "unitPrice": 7.99
            }
        ],
        "date": "2026-03-17T20:31:33.455+0000",
        "total": 28.96,
        "_links": {
            "self": {
                "href": "http://orders/orders/69b9ba2527262d00074421a2"
            },
            "order": {
                "href": "http://orders/orders/69b9ba2527262d00074421a2"
            }
        }
    }
]
```

### Real-time analysis

- Pre-demo order count: `66`
- Post-demo order count: `71`
- Net new successful orders created by this demo: `5`
- Declined attempts recorded in orders history: `0`

The five approved demo orders are now the newest entries in the order stream, and the declined `Holy` attempt correctly does not appear in persistent order history. An analyst scanning recent orders can spot the demo run immediately by looking for the new `2026-03-17` timestamps and the progression from the normal single-item baseline to the near-threshold basket and then to the three sub-second `Nerd leg` orders.

## Demo Narrative Summary

This live run demonstrated that a cognitive agent can create real test transactions through standard HTTP APIs and reason about them as they happen.

1. The agent established a clean normal baseline with a `$12.98` single-item order and verified that it matched the dominant historical basket shape.
2. The agent then created an `$84.31` five-item order that still passed payment, but clearly diverged from Sprint 1 norms on both basket depth and total value.
3. The agent confirmed the Holy sock paradox live: the item can be added to cart, but checkout fails with `406 Not Acceptable` because the fixed shipping fee pushes the total from `$99.99` to `$104.98`.
4. The agent reproduced a velocity anomaly with three approvals inside the same second and uncovered an additional state issue: checkout does not clear the cart, so replayed orders accumulate quantity and total value.
5. Every finding was produced through live API calls to `http://localhost:8888`, with zero code changes to the application under test.

## Final Assessment

The live demo validates the Sprint 1 intelligence and strengthens it with direct evidence:

- Threshold analysis is real, not hypothetical.
- Velocity detection is observable on live transactions.
- Cross-domain reasoning matters because the most important finding involved catalogue price, shipping, and payment logic together.
- The environment also has a checkout state-management weakness: orders can be replayed against a still-populated cart.
