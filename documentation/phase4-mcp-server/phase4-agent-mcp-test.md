# Phase 4 Agent MCP Test — Intelligence via Structured Tools

## Scope

This sweep was executed on 2026-03-18 using only typed Sock Shop MCP tools. No raw `curl`, `wget`, or bash HTTP calls were used.

Comparison note: All intelligence was gathered using typed MCP tools, not raw curl commands.

## Step 1: Catalogue Recon

- `sockshop_catalogue_list` returned 9 products.
- `sockshop_tags_list` returned 11 tags: `brown`, `geek`, `formal`, `blue`, `skin`, `red`, `action`, `sport`, `black`, `magic`, `green`.
- `sockshop_catalogue_size` confirmed catalogue size `9`.
- `sockshop_catalogue_get` on Holy sock (`03fef6ac-1896-4ce8-bd69-b798f85c6e0b`) returned:
  - Name: `Holy`
  - Price: `$99.99`
  - Stock count: `1`
  - Tags: `magic`, `action`
  - Description confirms it is positioned as a premium/special edition item.

## Step 2: Security Audit (No Login)

- `sockshop_customers_list` worked without logging in.
  - Result: 10 customer records exposed with names, usernames, and IDs.
  - Security finding: unauthenticated customer enumeration is possible.
- `sockshop_cards_list` worked without logging in.
  - Result: 4 payment card records exposed with raw `longNum`, `expires`, and `ccv` fields.
  - Security finding: this is a direct PCI-sensitive data exposure.
- `sockshop_addresses_list` worked without logging in.
  - Result: 4 postal addresses exposed with street, number, city, postcode, and country.
  - Security finding: unauthenticated address disclosure is present.

## Step 3: Authenticated Operations

- `sockshop_login` with `user` / `password` succeeded.
  - Customer ID: `57a98d98e4b00679b4a830b2`
- `sockshop_whoami` confirmed:
  - `isLoggedIn: true`
  - `username: user`
  - Session cookies `mdSid` and `loggedIn` present
- `sockshop_customer_me` returned the expected profile for `user` with HAL links to addresses and cards.

## Step 4: Shopping Flow

- `sockshop_cart_clear` succeeded.
- Added `Nerd leg` (`a0a4f044-b040-410d-8ead-4de0446aec7e`) successfully.
- Added `Classic` (`zzz4f044-b040-410d-8ead-4de0446aec7e`) successfully.
- `sockshop_cart_get` showed:
  - `Nerd leg` x1 at `$7.99`
  - `Classic` x1 at `$12.00`
- `sockshop_checkout` succeeded.
  - Order ID: `69b9ebd027262d00074421a6`
  - Checkout total: `$24.98`
  - The delta over item subtotal shows the expected shipping charge path is active.
- `sockshop_orders_list` showed the new order with timestamp `2026-03-18T00:03:28.175+0000`.

## Step 5: Holy Sock Paradox Test

- `sockshop_cart_clear` succeeded.
- Added Holy sock (`03fef6ac-1896-4ce8-bd69-b798f85c6e0b`) successfully.
- `sockshop_cart_get` showed Holy sock x1 at `$99.99`.
- `sockshop_checkout` failed as expected:
  - `Payment declined — order total $104.98 exceeds $100 threshold`
- Paradox confirmed:
  - The catalogue advertises Holy sock as the flagship premium item.
  - The effective checkout logic makes it unpurchasable because item price plus shipping crosses the `$100` payment threshold.

## Key Findings

- Catalogue statistics: 9 products, 11 tags, max-priced item is Holy sock at `$99.99`.
- Security issues:
  - Unauthenticated customer enumeration
  - Unauthenticated address disclosure
  - Unauthenticated full card data disclosure including PAN, expiry, and CVV
- Commerce logic issue:
  - Holy sock is listed for sale but cannot be purchased because checkout total becomes `$104.98`, which triggers the decline rule.

## Conclusion

The Sock Shop MCP tool surface provided a cleaner and more reliable interface for agent intelligence gathering than raw HTTP scripting. The test proved that agents can enumerate catalogue data, validate session state, execute purchases, and capture security findings entirely through structured tools while also surfacing a meaningful business-logic defect in the Holy sock purchase path.
