# Phase 4: Sock Shop MCP Server — Integration Test Results

Date and time of test: 2026-03-17T23:55:49.500Z to 2026-03-17T23:55:55.706Z

MCP server version/tool count:

- Version: `1.0.0`
- Tool count: `23`
- Tools exercised: `23/23`
- Base URL: `http://localhost:8888`

## Scenario Summary

| Scenario | Steps | Passed | Failed | Notes |
| --- | ---: | ---: | ---: | --- |
| Scenario 1: Catalogue Browsing (no auth) | 5 | 5 | 0 | All steps passed. |
| Scenario 2: Login + Whoami | 3 | 2 | 1 | Tool errored instead of returning anonymous session state: SOCKSHOP_USERNAME and SOCKSHOP_PASSWORD must be set before logging in.. |
| Scenario 3: Cart Operations | 11 | 11 | 0 | All steps passed. |
| Scenario 4: Checkout Success | 8 | 8 | 0 | All steps passed. |
| Scenario 5: Checkout Failure (Holy Sock Paradox) | 5 | 5 | 0 | All steps passed. |
| Scenario 6: Customer/Card Exposure (No Auth) | 3 | 3 | 0 | All steps passed. |
| Scenario 7: Customer Profile | 2 | 2 | 0 | All steps passed. |

## Detailed Results

## Scenario 1: Catalogue Browsing (no auth)

Passed: 5/5

### Step 1: Catalogue list returns the full 9-product set.

- Tool: `sockshop_catalogue_list`
- Pass: Yes
- Note: Returned 9 products, including Holy, Nerd leg, and Classic.
- Input:
```json
{}
```
- Output:
```json
{
  "count": 9,
  "sample": [
    {
      "id": "03fef6ac-1896-4ce8-bd69-b798f85c6e0b",
      "name": "Holy",
      "description": "Socks fit for a Messiah. You too can experience walking in water with these special edition beauties. Each hole is lovingly proggled to leave smooth edges. The only sock approved by a higher power.",
      "price": 99.99,
      "count": 1,
      "tags": [
        "action",
        "magic"
      ]
    },
    {
      "id": "3395a43e-2d88-40de-b95f-e00e1502085b",
      "name": "Colourful",
      "description": "proident occaecat irure et excepteur labore minim nisi amet irure",
      "price": 18,
      "count": 438,
      "tags": [
        "brown",
        "blue"
      ]
    },
    {
      "id": "510a0d7e-8e83-4193-b483-e27e09ddc34d",
      "name": "SuperSport XL",
      "description": "Ready for action. Engineers: be ready to smash that next bug! Be ready, with these super-action-sport-masterpieces. This particular engineer was chased away from the office with a stick.",
      "price": 15,
      "count": 820,
      "tags": [
        "sport",
        "formal",
        "black"
      ]
    }
  ]
}
```

### Step 2: Catalogue list filtered by the formal tag returns only formal products.

- Tool: `sockshop_catalogue_list`
- Pass: Yes
- Note: Returned 5 formal products.
- Input:
```json
{
  "tags": "formal"
}
```
- Output:
```json
{
  "count": 5,
  "sample": [
    {
      "id": "510a0d7e-8e83-4193-b483-e27e09ddc34d",
      "name": "SuperSport XL",
      "description": "Ready for action. Engineers: be ready to smash that next bug! Be ready, with these super-action-sport-masterpieces. This particular engineer was chased away from the office with a stick.",
      "price": 15,
      "count": 820,
      "tags": [
        "formal"
      ]
    },
    {
      "id": "808a2de1-1aaa-4c25-a9b9-6612e8f29a38",
      "name": "Crossed",
      "description": "A mature sock, crossed, with an air of nonchalance.",
      "price": 17.32,
      "count": 738,
      "tags": [
        "formal"
      ]
    },
    {
      "id": "819e1fbf-8b7e-4f6d-811f-693534916a8b",
      "name": "Figueroa",
      "description": "enim officia aliqua excepteur esse deserunt quis aliquip nostrud anim",
      "price": 14,
      "count": 808,
      "tags": [
        "formal"
      ]
    }
  ]
}
```

### Step 3: Catalogue get returns Holy with the expected price.

- Tool: `sockshop_catalogue_get`
- Pass: Yes
- Note: Holy resolved with price 99.99.
- Input:
```json
{
  "id": "03fef6ac-1896-4ce8-bd69-b798f85c6e0b"
}
```
- Output:
```json
{
  "id": "03fef6ac-1896-4ce8-bd69-b798f85c6e0b",
  "name": "Holy",
  "description": "Socks fit for a Messiah. You too can experience walking in water with these special edition beauties. Each hole is lovingly proggled to leave smooth edges. The only sock approved by a higher power.",
  "price": 99.99,
  "count": 1,
  "tags": [
    "magic",
    "action"
  ]
}
```

### Step 4: Catalogue size reports 9 products.

- Tool: `sockshop_catalogue_size`
- Pass: Yes
- Note: Size endpoint returned 9.
- Input:
```json
{}
```
- Output:
```json
{
  "size": 9
}
```

### Step 5: Tag list returns the 11 expected tags.

- Tool: `sockshop_tags_list`
- Pass: Yes
- Note: Tag list returned 11 tags.
- Input:
```json
{}
```
- Output:
```json
{
  "tags": {
    "count": 11,
    "sample": [
      "brown",
      "geek",
      "formal"
    ]
  }
}
```

## Scenario 2: Login + Whoami

Passed: 2/3

### Step 1: Whoami before login should report an anonymous session.

- Tool: `sockshop_whoami`
- Pass: No
- Note: Tool errored instead of returning anonymous session state: SOCKSHOP_USERNAME and SOCKSHOP_PASSWORD must be set before logging in..
- Input:
```json
{}
```
- Output:
```json
{
  "code": -32603,
  "message": "SOCKSHOP_USERNAME and SOCKSHOP_PASSWORD must be set before logging in."
}
```

### Step 2: Explicit login succeeds for user/password.

- Tool: `sockshop_login`
- Pass: Yes
- Note: Login succeeded for customer 57a98d98e4b00679b4a830b2.
- Input:
```json
{
  "username": "user",
  "password": "password"
}
```
- Output:
```json
{
  "success": true,
  "customerId": "57a98d98e4b00679b4a830b2",
  "username": "user"
}
```

### Step 3: Whoami after login returns the active customer session.

- Tool: `sockshop_whoami`
- Pass: Yes
- Note: Session is logged in as user.
- Input:
```json
{}
```
- Output:
```json
{
  "isLoggedIn": true,
  "customerId": "57a98d98e4b00679b4a830b2",
  "username": "user",
  "cookies": {
    "mdSid": true,
    "loggedIn": true
  }
}
```

## Scenario 3: Cart Operations

Passed: 11/11

### Step 1: Login succeeds before cart operations.

- Tool: `sockshop_login`
- Pass: Yes
- Note: Authenticated cart session established.
- Input:
```json
{
  "username": "user",
  "password": "password"
}
```
- Output:
```json
{
  "success": true,
  "customerId": "57a98d98e4b00679b4a830b2",
  "username": "user"
}
```

### Step 2: Cart clear empties any prior cart state.

- Tool: `sockshop_cart_clear`
- Pass: Yes
- Note: Cart clear returned success=true.
- Input:
```json
{}
```
- Output:
```json
{
  "success": true
}
```

### Step 3: Cart get returns an empty array after clearing.

- Tool: `sockshop_cart_get`
- Pass: Yes
- Note: Cart is empty.
- Input:
```json
{}
```
- Output:
```json
[]
```

### Step 4: Adding Nerd leg succeeds.

- Tool: `sockshop_cart_add_item`
- Pass: Yes
- Note: Nerd leg add acknowledged.
- Input:
```json
{
  "id": "a0a4f044-b040-410d-8ead-4de0446aec7e"
}
```
- Output:
```json
{
  "success": true,
  "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
  "quantityAdded": 1
}
```

### Step 5: Cart get shows one Nerd leg line item.

- Tool: `sockshop_cart_get`
- Pass: Yes
- Note: Cart contains a single Nerd leg item.
- Input:
```json
{}
```
- Output:
```json
[
  {
    "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
    "quantity": 1,
    "unitPrice": 7.99
  }
]
```

### Step 6: Adding Classic succeeds.

- Tool: `sockshop_cart_add_item`
- Pass: Yes
- Note: Classic add acknowledged.
- Input:
```json
{
  "id": "zzz4f044-b040-410d-8ead-4de0446aec7e"
}
```
- Output:
```json
{
  "success": true,
  "itemId": "zzz4f044-b040-410d-8ead-4de0446aec7e",
  "quantityAdded": 1
}
```

### Step 7: Cart get shows both Nerd leg and Classic.

- Tool: `sockshop_cart_get`
- Pass: Yes
- Note: Cart contains both expected item IDs.
- Input:
```json
{}
```
- Output:
```json
[
  {
    "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
    "quantity": 1,
    "unitPrice": 7.99
  },
  {
    "itemId": "zzz4f044-b040-410d-8ead-4de0446aec7e",
    "quantity": 1,
    "unitPrice": 12
  }
]
```

### Step 8: Removing Nerd leg succeeds.

- Tool: `sockshop_cart_remove_item`
- Pass: Yes
- Note: Remove-item call acknowledged.
- Input:
```json
{
  "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e"
}
```
- Output:
```json
{
  "success": true,
  "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e"
}
```

### Step 9: Cart get leaves Classic as the only remaining item.

- Tool: `sockshop_cart_get`
- Pass: Yes
- Note: Classic is the only remaining cart item.
- Input:
```json
{}
```
- Output:
```json
[
  {
    "itemId": "zzz4f044-b040-410d-8ead-4de0446aec7e",
    "quantity": 1,
    "unitPrice": 12
  }
]
```

### Step 10: Final cart clear succeeds.

- Tool: `sockshop_cart_clear`
- Pass: Yes
- Note: Cart clear returned success=true.
- Input:
```json
{}
```
- Output:
```json
{
  "success": true
}
```

### Step 11: Cart get is empty at the end of the flow.

- Tool: `sockshop_cart_get`
- Pass: Yes
- Note: Cart is empty after cleanup.
- Input:
```json
{}
```
- Output:
```json
[]
```

## Scenario 4: Checkout Success

Passed: 8/8

### Step 1: Login succeeds before checkout.

- Tool: `sockshop_login`
- Pass: Yes
- Note: Authenticated checkout session established.
- Input:
```json
{
  "username": "user",
  "password": "password"
}
```
- Output:
```json
{
  "success": true,
  "customerId": "57a98d98e4b00679b4a830b2",
  "username": "user"
}
```

### Step 2: Orders list captures the baseline before checkout.

- Tool: `sockshop_orders_list`
- Pass: Yes
- Note: Captured 73 baseline orders.
- Input:
```json
{}
```
- Output:
```json
{
  "count": 73,
  "sample": [
    {
      "id": "69b8516227262d000744215c",
      "customerId": "57a98d98e4b00679b4a830b2",
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
          "itemId": "808a2de1-1aaa-4c25-a9b9-6612e8f29a38",
          "quantity": 1,
          "unitPrice": 17.32
        }
      ],
      "shipment": {
        "name": "57a98d98e4b00679b4a830b2"
      },
      "date": "2026-03-16T18:52:18.253+0000",
      "total": 22.31
    },
    {
      "id": "69b8516227262d000744215d",
      "customerId": "57a98d98e4b00679b4a830b2",
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
          "itemId": "808a2de1-1aaa-4c25-a9b9-6612e8f29a38",
          "quantity": 1,
          "unitPrice": 17.32
        }
      ],
      "shipment": {
        "name": "57a98d98e4b00679b4a830b2"
      },
      "date": "2026-03-16T18:52:18.253+0000",
      "total": 22.31
    },
    {
      "id": "69b8516327262d000744215e",
      "customerId": "57a98d98e4b00679b4a830b2",
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
          "itemId": "837ab141-399e-4c1f-9abc-bace40296bac",
          "quantity": 1,
          "unitPrice": 15
        },
        {
          "itemId": "510a0d7e-8e83-4193-b483-e27e09ddc34d",
          "quantity": 1,
          "unitPrice": 15
        }
      ],
      "shipment": {
        "name": "57a98d98e4b00679b4a830b2"
      },
      "date": "2026-03-16T18:52:19.240+0000",
      "total": 34.99
    }
  ]
}
```

### Step 3: Cart is cleared before adding the checkout item.

- Tool: `sockshop_cart_clear`
- Pass: Yes
- Note: Cart clear returned success=true.
- Input:
```json
{}
```
- Output:
```json
{
  "success": true
}
```

### Step 4: Adding Nerd leg for checkout succeeds.

- Tool: `sockshop_cart_add_item`
- Pass: Yes
- Note: Nerd leg add acknowledged.
- Input:
```json
{
  "id": "a0a4f044-b040-410d-8ead-4de0446aec7e"
}
```
- Output:
```json
{
  "success": true,
  "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
  "quantityAdded": 1
}
```

### Step 5: Checkout succeeds with a total of 12.98.

- Tool: `sockshop_checkout`
- Pass: Yes
- Note: Checkout succeeded with order 69b9ea0827262d00074421a5.
- Input:
```json
{}
```
- Output:
```json
{
  "success": true,
  "orderId": "69b9ea0827262d00074421a5",
  "total": 12.98,
  "items": [
    {
      "id": "69b9ea08a027950007fa8ec4",
      "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
      "quantity": 1,
      "unitPrice": 7.99
    }
  ],
  "address": {
    "id": null,
    "number": "246",
    "street": "Whitelees Road",
    "city": "Glasgow",
    "postcode": "G67 3DL",
    "country": "United Kingdom"
  },
  "card": {
    "lastFour": "5918"
  },
  "shipment": {
    "id": "d99b4117-5901-484c-8f7e-e959ccf2393a",
    "name": "57a98d98e4b00679b4a830b2"
  }
}
```

### Step 6: Orders list includes the newly created order.

- Tool: `sockshop_orders_list`
- Pass: Yes
- Note: Order list grew from 73 to 74.
- Input:
```json
{}
```
- Output:
```json
{
  "count": 74,
  "sample": [
    {
      "id": "69b8516227262d000744215c",
      "customerId": "57a98d98e4b00679b4a830b2",
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
          "itemId": "808a2de1-1aaa-4c25-a9b9-6612e8f29a38",
          "quantity": 1,
          "unitPrice": 17.32
        }
      ],
      "shipment": {
        "name": "57a98d98e4b00679b4a830b2"
      },
      "date": "2026-03-16T18:52:18.253+0000",
      "total": 22.31
    },
    {
      "id": "69b8516227262d000744215d",
      "customerId": "57a98d98e4b00679b4a830b2",
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
          "itemId": "808a2de1-1aaa-4c25-a9b9-6612e8f29a38",
          "quantity": 1,
          "unitPrice": 17.32
        }
      ],
      "shipment": {
        "name": "57a98d98e4b00679b4a830b2"
      },
      "date": "2026-03-16T18:52:18.253+0000",
      "total": 22.31
    },
    {
      "id": "69b8516327262d000744215e",
      "customerId": "57a98d98e4b00679b4a830b2",
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
          "itemId": "837ab141-399e-4c1f-9abc-bace40296bac",
          "quantity": 1,
          "unitPrice": 15
        },
        {
          "itemId": "510a0d7e-8e83-4193-b483-e27e09ddc34d",
          "quantity": 1,
          "unitPrice": 15
        }
      ],
      "shipment": {
        "name": "57a98d98e4b00679b4a830b2"
      },
      "date": "2026-03-16T18:52:19.240+0000",
      "total": 34.99
    }
  ]
}
```

### Step 7: Orders get returns the new order detail.

- Tool: `sockshop_orders_get`
- Pass: Yes
- Note: Fetched order 69b9ea0827262d00074421a5 with total 12.98.
- Input:
```json
{
  "id": "69b9ea0827262d00074421a5"
}
```
- Output:
```json
{
  "id": "69b9ea0827262d00074421a5",
  "customerId": "57a98d98e4b00679b4a830b2",
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
    "name": "57a98d98e4b00679b4a830b2"
  },
  "date": "2026-03-17T23:55:52.871+0000",
  "total": 12.98
}
```

### Step 8: Cleanup clears the cart after checkout.

- Tool: `sockshop_cart_clear`
- Pass: Yes
- Note: Post-checkout cart cleanup succeeded.
- Input:
```json
{}
```
- Output:
```json
{
  "success": true
}
```

## Scenario 5: Checkout Failure (Holy Sock Paradox)

Passed: 5/5

### Step 1: Login succeeds before the Holy checkout attempt.

- Tool: `sockshop_login`
- Pass: Yes
- Note: Authenticated checkout session established.
- Input:
```json
{
  "username": "user",
  "password": "password"
}
```
- Output:
```json
{
  "success": true,
  "customerId": "57a98d98e4b00679b4a830b2",
  "username": "user"
}
```

### Step 2: Cart is cleared before adding Holy.

- Tool: `sockshop_cart_clear`
- Pass: Yes
- Note: Cart clear returned success=true.
- Input:
```json
{}
```
- Output:
```json
{
  "success": true
}
```

### Step 3: Adding Holy succeeds.

- Tool: `sockshop_cart_add_item`
- Pass: Yes
- Note: Holy add acknowledged.
- Input:
```json
{
  "id": "03fef6ac-1896-4ce8-bd69-b798f85c6e0b"
}
```
- Output:
```json
{
  "success": true,
  "itemId": "03fef6ac-1896-4ce8-bd69-b798f85c6e0b",
  "quantityAdded": 1
}
```

### Step 4: Checkout declines because the total exceeds the $100 threshold.

- Tool: `sockshop_checkout`
- Pass: Yes
- Note: Payment declined — order total $104.98 exceeds $100 threshold
- Input:
```json
{}
```
- Output:
```json
{
  "success": false,
  "error": "Payment declined — order total $104.98 exceeds $100 threshold",
  "total": 104.98
}
```

### Step 5: Cleanup clears the Holy cart after the failed checkout.

- Tool: `sockshop_cart_clear`
- Pass: Yes
- Note: Cart cleanup succeeded.
- Input:
```json
{}
```
- Output:
```json
{
  "success": true
}
```

## Scenario 6: Customer/Card Exposure (No Auth)

Passed: 3/3

### Step 1: Customers list is publicly readable.

- Tool: `sockshop_customers_list`
- Pass: Yes
- Note: Returned 9 public customer records.
- Input:
```json
{}
```
- Output:
```json
{
  "count": 9,
  "sample": [
    {
      "firstName": "Eve",
      "lastName": "Berger",
      "username": "Eve_Berger",
      "id": "57a98d98e4b00679b4a830af"
    },
    {
      "firstName": "User",
      "lastName": "Name",
      "username": "user",
      "id": "57a98d98e4b00679b4a830b2"
    },
    {
      "firstName": "User1",
      "lastName": "Name1",
      "username": "user1",
      "id": "57a98d98e4b00679b4a830b5"
    }
  ]
}
```

### Step 2: Cards list exposes full PAN, expiry, and CCV without authentication.

- Tool: `sockshop_cards_list`
- Pass: Yes
- Note: Public card endpoint returned full card data, confirming the Phase 3 PCI finding.
- Input:
```json
{}
```
- Output:
```json
{
  "count": 4,
  "sample": [
    {
      "longNum": "5953580604169678",
      "expires": "08/19",
      "ccv": "678",
      "id": "57a98d98e4b00679b4a830ae"
    },
    {
      "longNum": "5544154011345918",
      "expires": "08/19",
      "ccv": "958",
      "id": "57a98d98e4b00679b4a830b1"
    },
    {
      "longNum": "0908415193175205",
      "expires": "08/19",
      "ccv": "280",
      "id": "57a98d98e4b00679b4a830b4"
    }
  ]
}
```

### Step 3: Addresses list is publicly readable.

- Tool: `sockshop_addresses_list`
- Pass: Yes
- Note: Returned 4 public address records.
- Input:
```json
{}
```
- Output:
```json
{
  "count": 4,
  "sample": [
    {
      "street": "Whitelees Road",
      "number": "246",
      "country": "United Kingdom",
      "city": "Glasgow",
      "postcode": "G67 3DL",
      "id": "57a98d98e4b00679b4a830ad"
    },
    {
      "street": "Whitelees Road",
      "number": "246",
      "country": "United Kingdom",
      "city": "Glasgow",
      "postcode": "G67 3DL",
      "id": "57a98d98e4b00679b4a830b0"
    },
    {
      "street": "Maes-Y-Deri",
      "number": "4",
      "country": "United Kingdom",
      "city": "Aberdare",
      "postcode": "CF44 6TF",
      "id": "57a98d98e4b00679b4a830b3"
    }
  ]
}
```

## Scenario 7: Customer Profile

Passed: 2/2

### Step 1: Login succeeds before profile lookup.

- Tool: `sockshop_login`
- Pass: Yes
- Note: Authenticated profile session established.
- Input:
```json
{
  "username": "user",
  "password": "password"
}
```
- Output:
```json
{
  "success": true,
  "customerId": "57a98d98e4b00679b4a830b2",
  "username": "user"
}
```

### Step 2: Customer me returns the current user's profile.

- Tool: `sockshop_customer_me`
- Pass: Yes
- Note: Customer profile matched the seeded user account.
- Input:
```json
{}
```
- Output:
```json
{
  "firstName": "User",
  "lastName": "Name",
  "username": "user",
  "id": "57a98d98e4b00679b4a830b2",
  "_links": {
    "addresses": {
      "href": "http://user/customers/57a98d98e4b00679b4a830b2/addresses"
    },
    "cards": {
      "href": "http://user/customers/57a98d98e4b00679b4a830b2/cards"
    },
    "customer": {
      "href": "http://user/customers/57a98d98e4b00679b4a830b2"
    },
    "self": {
      "href": "http://user/customers/57a98d98e4b00679b4a830b2"
    }
  }
}
```


## Supplementary Tool Coverage

The task text named 7 core demo scenarios, but those scenarios do not cover all 23 tools. The supplementary pass below exercised the remaining surface: `sockshop_register`, `sockshop_cart_update_item`, `sockshop_addresses_create`, `sockshop_addresses_delete`, `sockshop_cards_create`, and `sockshop_cards_delete`.

## Supplementary Tool Coverage

Passed: 12/12

### Coverage Step 1: Register creates a new user and session.

- Tool: `sockshop_register`
- Pass: Yes
- Note: Registered mcp_phase4_1773791755046 as 69b9ea0bee11cb000111218d.
- Input:
```json
{
  "username": "mcp_phase4_1773791755046",
  "password": "password",
  "email": "mcp_phase4_1773791755046@example.test",
  "firstName": "Phase4",
  "lastName": "Integration"
}
```
- Output:
```json
{
  "success": true,
  "customerId": "69b9ea0bee11cb000111218d"
}
```

### Coverage Step 2: Whoami reflects the newly registered session.

- Tool: `sockshop_whoami`
- Pass: Yes
- Note: Whoami returned the new user mcp_phase4_1773791755046.
- Input:
```json
{}
```
- Output:
```json
{
  "isLoggedIn": true,
  "customerId": "69b9ea0bee11cb000111218d",
  "username": "mcp_phase4_1773791755046",
  "cookies": {
    "mdSid": true,
    "loggedIn": true
  }
}
```

### Coverage Step 3: Cart add succeeds for the supplementary user.

- Tool: `sockshop_cart_add_item`
- Pass: Yes
- Note: Supplementary cart add acknowledged.
- Input:
```json
{
  "id": "a0a4f044-b040-410d-8ead-4de0446aec7e"
}
```
- Output:
```json
{
  "success": true,
  "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
  "quantityAdded": 1
}
```

### Coverage Step 4: Cart update changes the quantity to 2.

- Tool: `sockshop_cart_update_item`
- Pass: Yes
- Note: Cart update returned quantity=2.
- Input:
```json
{
  "id": "a0a4f044-b040-410d-8ead-4de0446aec7e",
  "quantity": 2
}
```
- Output:
```json
{
  "success": true,
  "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
  "quantity": 2
}
```

### Coverage Step 5: Cart get reflects the updated quantity.

- Tool: `sockshop_cart_get`
- Pass: Yes
- Note: Cart quantity updated to 2 as expected.
- Input:
```json
{}
```
- Output:
```json
[
  {
    "itemId": "a0a4f044-b040-410d-8ead-4de0446aec7e",
    "quantity": 2,
    "unitPrice": 7.99
  }
]
```

### Coverage Step 6: Address create returns a new ID.

- Tool: `sockshop_addresses_create`
- Pass: Yes
- Note: Created address 69b9ea0bee11cb000111218e.
- Input:
```json
{
  "street": "Integration Road",
  "number": "42",
  "city": "London",
  "postcode": "EC1A 1AA",
  "country": "United Kingdom"
}
```
- Output:
```json
{
  "id": "69b9ea0bee11cb000111218e",
  "street": "Integration Road",
  "number": "42",
  "country": "United Kingdom",
  "city": "London",
  "postcode": "EC1A 1AA"
}
```

### Coverage Step 7: Addresses list contains the created address.

- Tool: `sockshop_addresses_list`
- Pass: Yes
- Note: Address 69b9ea0bee11cb000111218e is visible in the public address list.
- Input:
```json
{}
```
- Output:
```json
{
  "count": 5,
  "sample": [
    {
      "street": "Whitelees Road",
      "number": "246",
      "country": "United Kingdom",
      "city": "Glasgow",
      "postcode": "G67 3DL",
      "id": "57a98d98e4b00679b4a830ad"
    },
    {
      "street": "Whitelees Road",
      "number": "246",
      "country": "United Kingdom",
      "city": "Glasgow",
      "postcode": "G67 3DL",
      "id": "57a98d98e4b00679b4a830b0"
    },
    {
      "street": "Maes-Y-Deri",
      "number": "4",
      "country": "United Kingdom",
      "city": "Aberdare",
      "postcode": "CF44 6TF",
      "id": "57a98d98e4b00679b4a830b3"
    }
  ]
}
```

### Coverage Step 8: Card create returns a new ID.

- Tool: `sockshop_cards_create`
- Pass: Yes
- Note: Created card 69b9ea0bee11cb000111218f.
- Input:
```json
{
  "longNum": "4111111111111111",
  "expires": "12/30",
  "ccv": "123"
}
```
- Output:
```json
{
  "id": "69b9ea0bee11cb000111218f",
  "longNum": "4111111111111111",
  "expires": "12/30",
  "ccv": "123"
}
```

### Coverage Step 9: Cards list contains the created card.

- Tool: `sockshop_cards_list`
- Pass: Yes
- Note: Card 69b9ea0bee11cb000111218f is visible in the public card list.
- Input:
```json
{}
```
- Output:
```json
{
  "count": 5,
  "sample": [
    {
      "longNum": "5953580604169678",
      "expires": "08/19",
      "ccv": "678",
      "id": "57a98d98e4b00679b4a830ae"
    },
    {
      "longNum": "5544154011345918",
      "expires": "08/19",
      "ccv": "958",
      "id": "57a98d98e4b00679b4a830b1"
    },
    {
      "longNum": "0908415193175205",
      "expires": "08/19",
      "ccv": "280",
      "id": "57a98d98e4b00679b4a830b4"
    }
  ]
}
```

### Coverage Step 10: Address delete succeeds.

- Tool: `sockshop_addresses_delete`
- Pass: Yes
- Note: Deleted address 69b9ea0bee11cb000111218e.
- Input:
```json
{
  "id": "69b9ea0bee11cb000111218e"
}
```
- Output:
```json
{
  "success": true,
  "id": "69b9ea0bee11cb000111218e"
}
```

### Coverage Step 11: Card delete succeeds.

- Tool: `sockshop_cards_delete`
- Pass: Yes
- Note: Deleted card 69b9ea0bee11cb000111218f.
- Input:
```json
{
  "id": "69b9ea0bee11cb000111218f"
}
```
- Output:
```json
{
  "success": true,
  "id": "69b9ea0bee11cb000111218f"
}
```

### Coverage Step 12: Supplementary cart cleanup succeeds.

- Tool: `sockshop_cart_clear`
- Pass: Yes
- Note: Supplementary cart cleanup succeeded.
- Input:
```json
{}
```
- Output:
```json
{
  "success": true
}
```


## MCP Tools vs Raw Curl

- MCP kept session handling inside a single long-lived process, which made login, cart, and checkout tests less error-prone than the Phase 3 curl flows that had to manage cookie jars explicitly.
- MCP responses were structurally normalized for several endpoints, especially catalogue and cart data, so assertions were shorter and less coupled to HAL response shapes than the Phase 3 curl probes.
- Raw curl was still better for surfacing transport-level behavior such as exact HTTP status codes, proxy quirks, and unauthenticated edge routing. The MCP layer hides some of that detail behind tool abstractions.
- The current MCP surface improves readability for business-flow tests, but it also exposes a product gap: cart merge on login cannot be verified through MCP alone because there is no anonymous cart tool to seed a pre-login basket.
- Another behavior gap surfaced during MCP testing: `sockshop_whoami` does not report anonymous state. It calls `ensureLoggedIn()`, so without credential env vars it errors instead of returning `isLoggedIn: false`.

## Findings

- The server built cleanly and advertised all 23 expected tools after a full MCP initialize handshake.
- Catalogue, cart, checkout, order history, customer profile, and the public data-exposure flows all worked through MCP.
- The Holy checkout paradox remains reproducible through MCP: `Holy` is listed at `$99.99`, shipping adds `$4.99`, and checkout returns a handled decline at `$104.98`.
- Public access to `customers`, `cards`, and `addresses` is still trivially reproducible through MCP, including full PAN, expiry, and CCV exposure on `sockshop_cards_list`.
- `sockshop_whoami` failed the pre-login expectation in the test plan because the implementation attempts automatic login rather than reporting current session state.

## Summary

- Total tools tested: `23/23`
- Total core scenarios: `7`
- Fully passing core scenarios: `6/7`
- Core step pass rate: `97.3%` (`36` passed, `1` failed)
- Supplementary tool coverage pass: `Yes`
