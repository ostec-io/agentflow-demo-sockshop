# Live Cart CRUD Operations Report

**Date:** 2026-03-16
**Target:** `http://localhost:8888` (Sock Shop front-end proxy)
**Auth:** Basic auth `user:password` via cookie

---

## 1. CRUD Verification

### 1.1 Login

```
GET /login (Basic auth user:password)
```

**Status:** `200 OK`
**Result:** Cookie set successfully. Session cookie stored for subsequent requests.

---

### 1.2 READ - Get Current Cart

```
GET /cart
```

**Status:** `200 OK`
**Response:**
```json
[
  {
    "id": "69b85200a027950007fa8e4d",
    "itemId": "03fef6ac-1896-4ce8-bd69-b798f85c6e0b",
    "quantity": 1,
    "unitPrice": 99.99
  }
]
```

Cart returned as a JSON array of item objects. Pre-existing item was present from a prior session.

---

### 1.3 CREATE - Add Item to Cart

```
POST /cart
Content-Type: application/json
{"id":"03fef6ac-1896-4ce8-bd69-b798f85c6e0b","quantity":1}
```

**Status:** `201 Created`
**Response Body:** Empty

**Cart after add:**
```json
[
  {
    "id": "69b85200a027950007fa8e4d",
    "itemId": "03fef6ac-1896-4ce8-bd69-b798f85c6e0b",
    "quantity": 2,
    "unitPrice": 99.99
  }
]
```

The item already existed in the cart. The service **incremented the quantity** from 1 to 2 rather than creating a duplicate entry (see Section 3 for details).

---

### 1.4 CREATE - Add Second (Different) Item

```
POST /cart
Content-Type: application/json
{"id":"510a0d7e-8e83-4193-b483-e27e09ddc34d","quantity":2}
```

**Status:** `201 Created`
**Response Body:** Empty

**Cart after add:**
```json
[
  {
    "id": "69b85200a027950007fa8e4d",
    "itemId": "03fef6ac-1896-4ce8-bd69-b798f85c6e0b",
    "quantity": 2,
    "unitPrice": 99.99
  },
  {
    "id": "69b863d5a027950007fa8e57",
    "itemId": "510a0d7e-8e83-4193-b483-e27e09ddc34d",
    "quantity": 1,
    "unitPrice": 15.00
  }
]
```

**Finding:** The request body specified `"quantity": 2`, but the item was stored with `quantity: 1`. The front-end proxy / carts service **ignores the requested quantity** on POST and always defaults to 1 for new items.

---

### 1.5 DELETE - Remove Item from Cart

```
DELETE /cart/{itemId}
```

**First attempt** using the MongoDB document `id` (`69b863d5a027950007fa8e57`):
- **Status:** `500 Internal Server Error` - The front-end expects the **catalogue itemId**, not the MongoDB document id.

**Second attempt** using the catalogue `itemId` (`510a0d7e-8e83-4193-b483-e27e09ddc34d`):
- **Status:** `202 Accepted`
- **Response Body:** Empty

**Cart after delete:**
```json
[
  {
    "id": "69b863e7a027950007fa8e60",
    "itemId": "03fef6ac-1896-4ce8-bd69-b798f85c6e0b",
    "quantity": 1,
    "unitPrice": 99.99
  }
]
```

**Finding:** After the delete, the remaining item's MongoDB `id` changed and its `quantity` reset from 2 to 1. This suggests the front-end proxy reconstructs cart state by re-fetching from the catalogue rather than performing a simple in-place delete.

---

### 1.6 DELETE - Empty Cart (All Items Removed)

```
DELETE /cart/03fef6ac-1896-4ce8-bd69-b798f85c6e0b
```

**Status:** `202 Accepted`

**Cart after final delete:**
```json
[]
```

**Status:** `200 OK` - Empty array returned. No error on empty cart.

---

## 2. Cart Schema

### Item Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | MongoDB auto-generated document ID. Changes across cart mutations. |
| `itemId` | `string` | Catalogue product UUID. Used as the key for add/delete operations via the front-end. |
| `quantity` | `integer` | Number of this item in the cart. Defaults to 1 on first add; increments by 1 on duplicate add. |
| `unitPrice` | `float` | Price per unit. Populated from the catalogue service (e.g., `99.99`, `15.00`). Set to `0.0` for unknown items. |

### Cart Response

The `GET /cart` endpoint returns a **JSON array** of Item objects (`Item[]`), not a wrapper object. An empty cart returns `[]`.

---

## 3. Duplicate Item Behavior

| Action | Result |
|--------|--------|
| POST item that **does not exist** in cart | New item created with `quantity: 1` (ignores requested quantity) |
| POST item that **already exists** in cart | Existing item's `quantity` incremented by 1 |
| POST same item **twice in succession** (from empty cart) | First POST creates with `quantity: 1`, second POST increments to `quantity: 2` |

**Verified sequence** (starting from empty cart):
1. `POST {"id":"03fef6ac-...","quantity":1}` -> item created, quantity = 1
2. `POST {"id":"03fef6ac-...","quantity":1}` -> same item, quantity = 2

The service uses `itemId` for equality matching. Duplicate detection works correctly - no duplicate entries are created.

---

## 4. Edge Cases

### 4.1 Empty Cart

```
GET /cart (with no items)
```

**Status:** `200 OK`
**Response:** `[]`

The service handles empty carts gracefully, returning an empty JSON array.

### 4.2 Invalid / Non-Existent Catalogue Item ID

```
POST /cart
{"id":"nonexistent-item-id-12345","quantity":1}
```

**Status:** `201 Created`

**Cart contents after:**
```json
{
  "id": "69b863f4a027950007fa8e63",
  "itemId": "",
  "quantity": 1,
  "unitPrice": 0.0
}
```

**Finding:** The service accepts **any** item ID without validation against the catalogue. The item is created with an **empty `itemId`**, `quantity: 1`, and `unitPrice: 0.0`. This is a validation gap - the front-end proxy does not verify item existence before adding to cart.

### 4.3 Delete Non-Existent Item

```
DELETE /cart/nonexistent-item-id-12345
```

**Status:** `500 Internal Server Error`

The service returns a 500 error when attempting to delete an item that does not exist in the cart. There is no graceful 404 handling.

### 4.4 Delete Using MongoDB Document ID vs Catalogue Item ID

| ID Type | Example | Result |
|---------|---------|--------|
| Catalogue `itemId` (UUID) | `510a0d7e-8e83-4193-b483-e27e09ddc34d` | `202 Accepted` - works |
| MongoDB document `id` | `69b863d5a027950007fa8e57` | `500 Internal Server Error` - fails |

The `DELETE /cart/{id}` endpoint expects the **catalogue itemId**, not the MongoDB document id.

---

## 5. Summary of Findings

| # | Finding | Severity |
|---|---------|----------|
| 1 | Requested quantity on POST is **ignored**; always defaults to 1 | Low - cosmetic mismatch |
| 2 | Invalid catalogue IDs are **accepted** without validation, creating ghost items with empty itemId | Medium - data integrity |
| 3 | Delete of non-existent item returns **500** instead of 404 | Low - poor error handling |
| 4 | MongoDB document `id` values **change** after cart mutations (delete of another item) | Medium - unreliable for client-side caching |
| 5 | `unitPrice` is set to `0.0` for invalid items, which could lead to **free item** exploits if orders are placed | High - potential pricing bypass |
| 6 | Duplicate items are correctly merged (quantity increment) | OK - working as designed |
| 7 | Empty cart returns clean `[]` with 200 status | OK - working as designed |
