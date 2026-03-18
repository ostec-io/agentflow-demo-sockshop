# Sock Shop MCP Tool Reference

23 tools across 6 domains wrapping the complete Sock Shop gateway API surface.

## Authentication (3 tools)

### `sockshop_login`
Log in through the Sock Shop gateway using the session-cookie auth flow.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | yes | Sock Shop username |
| `password` | string | yes | Sock Shop password |

### `sockshop_register`
Register a new Sock Shop user through the gateway and establish a session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `username` | string | yes | Sock Shop username |
| `password` | string | yes | Sock Shop password |
| `email` | string | yes | Customer email address |
| `firstName` | string | yes | Customer first name |
| `lastName` | string | yes | Customer last name |

### `sockshop_whoami`
Return the current gateway session state, auto-logging in from env vars when needed.

*No parameters.*

---

## Catalogue (4 tools)

### `sockshop_catalogue_list`
List products from the Sock Shop catalogue. Optionally filter by tags, paginate with page and size.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tags` | string | no | Comma-separated tag filter, e.g. `"formal"` or `"sport,blue"` |
| `page` | number | no | Page number, starting from 1 |
| `size` | number | no | Number of products per page |

### `sockshop_catalogue_get`
Get a single product from the Sock Shop catalogue by UUID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Product UUID |

### `sockshop_catalogue_size`
Get the number of products in the Sock Shop catalogue, optionally filtered by tags.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tags` | string | no | Comma-separated tag filter |

### `sockshop_tags_list`
List the available Sock Shop product tags.

*No parameters.*

---

## Cart (5 tools)

### `sockshop_cart_get`
List items in the current cart for the active Sock Shop session. Auto-logs in from env vars when needed.

*No parameters.*

### `sockshop_cart_add_item`
Add a catalogue product to the current cart. The gateway always adds quantity 1 per call.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Product ID from the Sock Shop catalogue |

### `sockshop_cart_update_item`
Update the quantity of a catalogue product in the current cart.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Product ID from the Sock Shop catalogue |
| `quantity` | number | yes | Desired quantity for that product |

### `sockshop_cart_clear`
Delete all items from the current cart.

*No parameters.*

### `sockshop_cart_remove_item`
Remove a single catalogue item from the current cart by itemId.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `itemId` | string | yes | Catalogue product UUID to remove |

---

## Orders (3 tools)

### `sockshop_orders_list`
List orders for the current logged-in Sock Shop user.

*No parameters.*

### `sockshop_orders_get`
Get a single order by ID for the active Sock Shop session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Order ID |

### `sockshop_checkout`
Place an order for the current cart after validating that the active user has an address and card on file. Detects the $100 payment threshold and adds $4.99 flat shipping.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `addressId` | string | no | Address ID to validate before checkout |
| `cardId` | string | no | Card ID to validate before checkout |

---

## Cards / Payment (3 tools)

### `sockshop_cards_list`
List all cards from the public Sock Shop gateway endpoint. **Warning:** This exposes full card data including PAN and CVV.

*No parameters.*

### `sockshop_cards_create`
Create a card for the currently authenticated Sock Shop user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `longNum` | string | yes | Full card number |
| `expires` | string | yes | Expiry string, e.g. `"08/25"` |
| `ccv` | string | yes | Card security code |

### `sockshop_cards_delete`
Delete a card by ID through the Sock Shop gateway.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Card ID |

---

## Customers / Users (5 tools)

### `sockshop_customers_list`
List all Sock Shop customers from the public gateway endpoint. **Warning:** No authentication required.

*No parameters.*

### `sockshop_customer_me`
Get the current authenticated customer's profile.

*No parameters.*

### `sockshop_addresses_list`
List all addresses from the public Sock Shop gateway endpoint. **Warning:** No authentication required.

*No parameters.*

### `sockshop_addresses_create`
Create an address for the currently authenticated Sock Shop user.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `street` | string | yes | Street name |
| `number` | string | yes | Street number or unit |
| `country` | string | yes | Country name |
| `city` | string | yes | City name |
| `postcode` | string | yes | Postal code |

### `sockshop_addresses_delete`
Delete an address by ID through the Sock Shop gateway.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | string | yes | Address ID |

---

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `SOCKSHOP_BASE_URL` | `http://localhost:8888` | Sock Shop edge-router URL |
| `SOCKSHOP_USERNAME` | - | Auto-login username |
| `SOCKSHOP_PASSWORD` | - | Auto-login password |

## Transport Modes

| Mode | Entry Point | Use Case |
|------|-------------|----------|
| **Stdio** (default) | `npm start` | Claude Desktop, local AgentFlow |
| **SSE/HTTP** | `npm run start:http` | Docker Compose, network deployment |
