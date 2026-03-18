# Live Catalogue & Inventory Report

**Date:** 2026-03-16
**Base URL:** `http://localhost:8888`

---

## 1. Schema Validation

**Documented schema (from service-catalogue.md):**

```json
{
  "id": "string (UUID)",
  "name": "string",
  "description": "string",
  "imageUrl": ["string", "string"],
  "price": "float",
  "count": "int",
  "tag": ["string", ...]
}
```

**Validation result: PASS (with notes)**

Every item in the live response contains all documented fields with correct types:

| Field       | Expected Type  | Actual Type | Match |
|-------------|---------------|-------------|-------|
| id          | string (UUID) | string (UUID) | YES |
| name        | string        | string        | YES |
| description | string        | string        | YES |
| imageUrl    | string[]      | string[]      | YES |
| price       | float         | float/int     | YES (integers like `18` are valid JSON numbers) |
| count       | int           | int           | YES |
| tag         | string[]      | string[]      | YES |

No extra or missing fields observed. The `/catalogue/size` endpoint returns `{"size": N, "err": null}` matching the documented schema. The `/tags` endpoint returns `{"tags": [...], "err": null}` as documented.

---

## 2. Inventory Table

**Total items:** 9 (from `/catalogue/size`: `{"size":9,"err":null}`)

| # | Name | ID | Price | Stock Count | Tags | Flag |
|---|------|----|-------|-------------|------|------|
| 1 | Holy | `03fef6ac-1896-4ce8-bd69-b798f85c6e0b` | $99.99 | 1 | action, magic | :warning: **LOW STOCK** |
| 2 | Colourful | `3395a43e-2d88-40de-b95f-e00e1502085b` | $18.00 | 438 | brown, blue | |
| 3 | SuperSport XL | `510a0d7e-8e83-4193-b483-e27e09ddc34d` | $15.00 | 820 | sport, formal, black | |
| 4 | Crossed | `808a2de1-1aaa-4c25-a9b9-6612e8f29a38` | $17.32 | 738 | blue, action, red, formal | |
| 5 | Figueroa | `819e1fbf-8b7e-4f6d-811f-693534916a8b` | $14.00 | 808 | green, formal, blue | |
| 6 | Cat socks | `837ab141-399e-4c1f-9abc-bace40296bac` | $15.00 | 175 | brown, formal, green | |
| 7 | Nerd leg | `a0a4f044-b040-410d-8ead-4de0446aec7e` | $7.99 | 115 | blue, skin | |
| 8 | YouTube.sock | `d3588630-ad8e-49df-bbd7-3167f7efb246` | $10.99 | 801 | formal, geek | |
| 9 | Classic | `zzz4f044-b040-410d-8ead-4de0446aec7e` | $12.00 | 127 | brown, green | |

**Low stock alert:** "Holy" has only **1 unit** in stock (threshold: < 5).

**Price range:** $7.99 (Nerd leg) to $99.99 (Holy)
**Total inventory units:** 4,023

---

## 3. Pagination Behavior

### Test: `page=1&size=3`

**Result:** 3 items returned — Holy, Colourful, SuperSport XL

### Test: `page=2&size=3`

**Result:** 3 items returned — Crossed, Figueroa, Cat socks

### Analysis: PASS

- Page 1 and page 2 return non-overlapping sets of 3 items each.
- Items are ordered by ID (alphabetical UUID order), consistent with the documented default `sort=id`.
- With 9 total items and size=3, we expect 3 full pages. Pages 1 and 2 each return 3 items as expected.

**Note:** The documented default `size` is 10, and the full `/catalogue` call (no pagination params) returns all 9 items in a single page, confirming the default behavior.

---

## 4. Tag Filtering

### Test: `tags=geek`

**Result:** 1 item returned — YouTube.sock

**Correct subset?** YES — YouTube.sock is the only item with the "geek" tag in the full catalogue.

### Test: `tags=formal`

**Result:** 5 items returned:
1. SuperSport XL
2. Crossed
3. Figueroa
4. Cat socks
5. YouTube.sock

**Correct subset?** YES — all 5 items tagged "formal" in the full catalogue are returned.

### Tag filtering anomaly: truncated tag arrays

When filtering by tag, the response only includes the **matched tag** in each item's `tag` array, not the full set of tags:

- YouTube.sock normally has `["formal", "geek"]` but returns `["geek"]` when filtered by `tags=geek` and `["formal"]` when filtered by `tags=formal`.
- SuperSport XL normally has `["sport", "formal", "black"]` but returns `["formal"]` when filtered by `tags=formal`.

**Root cause:** The SQL query uses `GROUP_CONCAT` on the tag name joined through `sock_tag`, but the `WHERE` clause filters to only the matching tag rows before the `GROUP_CONCAT`, so non-matching tags are excluded from the concatenation.

This is a **data fidelity bug** — consumers filtering by tag will see incomplete tag data on the returned items.

---

## 5. Anomalies & Discrepancies

### A1: Item count mismatch (9 vs documented 10)

The documentation states "Seed data: 10 socks" but the live catalogue contains only **9 socks**. One sock from the seed data is missing. The `/catalogue/size` endpoint confirms `{"size": 9}`.

### A2: Tag truncation on filtered queries

As detailed in Section 4, tag-filtered responses only show the matched tag, not the full tag set. This means API consumers cannot rely on the `tag` array being complete when using the `tags` query parameter.

### A3: Duplicate image URLs

"Colourful" (`3395a43e`) has identical `imageUrl` entries:
```json
"imageUrl": ["/catalogue/images/colourful_socks.jpg", "/catalogue/images/colourful_socks.jpg"]
```
This is likely a data issue — `image_url_1` and `image_url_2` in the database both point to the same file.

### A4: Non-standard ID format

"Classic" has the ID `zzz4f044-b040-410d-8ead-4de0446aec7e` which starts with `zzz` — not a valid UUID v4 (should start with a hex character). All other IDs appear to be valid UUIDs. This may be intentional test data but deviates from the UUID format implied by the schema.

### A5: Tag order inconsistency between list and detail endpoints

Individual item detail (`/catalogue/{id}`) may return tags in a different order than the list endpoint (`/catalogue`). For example, "Holy" shows `["action", "magic"]` in the list but `["magic", "action"]` in the detail view. This is due to non-deterministic `GROUP_CONCAT` ordering in MySQL.

### A6: Available tags vs used tags

The `/tags` endpoint returns 11 tags: `brown, geek, formal, blue, skin, red, action, sport, black, magic, green`. Cross-referencing with the inventory, all 11 tags are used by at least one item. No orphan tags detected.

---

## 6. Raw Endpoint Responses

### GET /catalogue/size
```json
{"size":9,"err":null}
```

### GET /tags
```json
{"tags":["brown","geek","formal","blue","skin","red","action","sport","black","magic","green"],"err":null}
```

---

*Report generated by live API probe on 2026-03-16.*
