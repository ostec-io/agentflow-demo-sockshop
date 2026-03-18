# Inventory Intelligence & Demand Forecast

**Date:** 2026-03-17
**Environment:** Sock Shop @ `http://localhost:8888`
**Method:** Live API pulls via `curl` for catalogue, tags, and orders; payment threshold verified against the running `payment` service after confirming the front-end gateway does not expose `/paymentAuth`

Data snapshot used in this report:

| Metric | Value |
|--------|-------|
| Catalogue items | 9 |
| Orders analysed | 66 |
| Tag vocabulary | 11 tags |
| Shipping charge | $4.99 flat rate |
| Payment decline threshold | $100.00 on the live instance |

---

## 1. Current Inventory Status Dashboard

| Product Name | Product ID | Price | Current Stock | Status |
|--------------|------------|-------|---------------|--------|
| Holy | `03fef6ac-1896-4ce8-bd69-b798f85c6e0b` | $99.99 | 1 | CRITICAL |
| Colourful | `3395a43e-2d88-40de-b95f-e00e1502085b` | $18.00 | 438 | HEALTHY |
| SuperSport XL | `510a0d7e-8e83-4193-b483-e27e09ddc34d` | $15.00 | 820 | HEALTHY |
| Crossed | `808a2de1-1aaa-4c25-a9b9-6612e8f29a38` | $17.32 | 738 | HEALTHY |
| Figueroa | `819e1fbf-8b7e-4f6d-811f-693534916a8b` | $14.00 | 808 | HEALTHY |
| Cat socks | `837ab141-399e-4c1f-9abc-bace40296bac` | $15.00 | 175 | ADEQUATE |
| Nerd leg | `a0a4f044-b040-410d-8ead-4de0446aec7e` | $7.99 | 115 | ADEQUATE |
| YouTube.sock | `d3588630-ad8e-49df-bbd7-3167f7efb246` | $10.99 | 801 | HEALTHY |
| Classic | `zzz4f044-b040-410d-8ead-4de0446aec7e` | $12.00 | 127 | ADEQUATE |

Status rules used:

- `CRITICAL`: count `<= 5`
- `LOW`: count `<= 50`
- `ADEQUATE`: count `<= 200`
- `HEALTHY`: count `> 200`

Initial readout:

- Only one SKU is in a true shortage state: `Holy` with 1 unit.
- No SKU is currently in the `LOW` band.
- The rest of the catalogue is comfortably stocked, with 5 of 9 items in `HEALTHY` territory.

---

## 2. Demand Velocity Analysis

The demand model treats one order as one demand cycle. In this dataset every order line uses quantity `1`, so `itemId appearances` and `units sold` are identical.

| Product | Item ID Appearances | Units Sold | Revenue | Demand Velocity (units / 66 orders) |
|---------|----------------------|------------|---------|-------------------------------------|
| Holy | 0 | 0 | $0.00 | 0.0000 |
| Colourful | 7 | 7 | $126.00 | 0.1061 |
| SuperSport XL | 14 | 14 | $210.00 | 0.2121 |
| Crossed | 12 | 12 | $207.84 | 0.1818 |
| Figueroa | 10 | 10 | $140.00 | 0.1515 |
| Cat socks | 11 | 11 | $165.00 | 0.1667 |
| Nerd leg | 6 | 6 | $47.94 | 0.0909 |
| YouTube.sock | 11 | 11 | $120.89 | 0.1667 |
| Classic | 12 | 12 | $144.00 | 0.1818 |

Demand leaders:

- `SuperSport XL` is the highest-volume SKU at 14 units sold and $210.00 revenue.
- `Crossed` is a close second in revenue at $207.84 from 12 units sold.
- `Holy` has zero observed demand in the full order history.

---

## 3. Stock-to-Demand Ratio

Because the observed history is a compact 66-order snapshot, stock cover is expressed as estimated `orders remaining` rather than calendar days.

| Product | Current Stock | Demand Velocity | Stock / Demand Ratio | Estimated Orders Remaining | Runout Within Next 10 Orders |
|---------|---------------|-----------------|----------------------|----------------------------|------------------------------|
| Holy | 1 | 0.0000 | N/A | N/A | No historical demand |
| Colourful | 438 | 0.1061 | 4129.71 | 4129.71 | No |
| SuperSport XL | 820 | 0.2121 | 3865.71 | 3865.71 | No |
| Crossed | 738 | 0.1818 | 4059.00 | 4059.00 | No |
| Figueroa | 808 | 0.1515 | 5332.80 | 5332.80 | No |
| Cat socks | 175 | 0.1667 | 1050.00 | 1050.00 | No |
| Nerd leg | 115 | 0.0909 | 1265.00 | 1265.00 | No |
| YouTube.sock | 801 | 0.1667 | 4806.00 | 4806.00 | No |
| Classic | 127 | 0.1818 | 698.50 | 698.50 | No |

Stock-cover findings:

- No demand-active SKU is projected to run out within the next 10 orders.
- `Classic` has the shortest cover among sellable items at roughly 699 orders, which is still extremely safe.
- Most of the catalogue is materially overstocked relative to current demand velocity.

---

## 4. Category Analysis

Tag totals are non-exclusive: each product contributes to every tag it carries.

| Tag | Units Sold | Current Stock | Revenue | Assessment |
|-----|------------|---------------|---------|------------|
| formal | 58 | 3342 | $843.73 | Highest-demand and highest-stock tag; no shortage pressure |
| blue | 35 | 2099 | $521.78 | Strong demand and deep coverage |
| green | 33 | 1110 | $449.00 | Balanced, with adequate-to-high stock across 3 SKUs |
| brown | 30 | 740 | $435.00 | Good demand, still heavily stocked |
| black | 14 | 820 | $210.00 | Single-SKU tag carried by SuperSport XL; overstocked |
| sport | 14 | 820 | $210.00 | Same concentration as black; no stock risk |
| action | 12 | 739 | $207.84 | Driven almost entirely by Crossed; `Holy` adds dead stock |
| red | 12 | 738 | $207.84 | Single-SKU tag with deep stock |
| geek | 11 | 801 | $120.89 | Demand is modest relative to stock |
| skin | 6 | 115 | $47.94 | Lowest active-demand tag, still safely stocked |
| magic | 0 | 1 | $0.00 | Effective stockout/dead inventory category because it is tied to Holy |

Category conclusions:

- `formal` dominates both demand and inventory because it spans SuperSport XL, Crossed, Figueroa, Cat socks, and YouTube.sock.
- No demand-active category faces a near-term stockout risk.
- `magic` is the only category with a structural issue: it has stock on paper, but that stock is trapped in an unsellable SKU.

---

## 5. Price-Demand Correlation

The observed correlation between `price` and `units sold` is **-0.7885**, which indicates a strong negative relationship in this sample: cheaper items generally sell more often, though not perfectly.

### Price vs Units Sold

| Price | Product | Units Sold | Plot |
|-------|---------|------------|------|
| $7.99 | Nerd leg | 6 | ###### |
| $10.99 | YouTube.sock | 11 | ########### |
| $12.00 | Classic | 12 | ############ |
| $14.00 | Figueroa | 10 | ########## |
| $15.00 | Cat socks | 11 | ########### |
| $15.00 | SuperSport XL | 14 | ############## |
| $17.32 | Crossed | 12 | ############ |
| $18.00 | Colourful | 7 | ####### |
| $99.99 | Holy | 0 | |

### Revenue Efficiency

Revenue efficiency is calculated as `revenue / current stock`.

| Product | Revenue | Stock | Revenue per Stock Unit |
|---------|---------|-------|------------------------|
| Classic | $144.00 | 127 | 1.1339 |
| Cat socks | $165.00 | 175 | 0.9429 |
| Nerd leg | $47.94 | 115 | 0.4169 |
| Colourful | $126.00 | 438 | 0.2877 |
| Crossed | $207.84 | 738 | 0.2816 |
| SuperSport XL | $210.00 | 820 | 0.2561 |
| Figueroa | $140.00 | 808 | 0.1733 |
| YouTube.sock | $120.89 | 801 | 0.1509 |
| Holy | $0.00 | 1 | 0.0000 |

Most profitable / efficient SKUs:

- `Classic` is the most efficient product: solid demand, modest stock, and the highest revenue per stocked unit.
- `Cat socks` is the second-best performer on efficiency while also producing healthy gross revenue.
- `SuperSport XL` and `Crossed` generate the most gross revenue, but both are sitting on very large inventory pools.

---

## 6. The "Holy Sock Paradox"

This is the clearest inventory defect in the current environment.

- `Holy` list price: **$99.99**
- Flat shipping charge: **$4.99**
- Checkout total for a basket containing only `Holy`: **$104.98**
- Live payment authorisation ceiling: **$100.00**
- Verified payment behavior:
  `POST /paymentAuth` with `{"Amount":100}` returns `{"authorised":true,"message":"Payment authorised"}`
  `POST /paymentAuth` with `{"Amount":104.98}` returns `{"authorised":false,"message":"Payment declined: amount exceeds 100.00"}`

Implication:

- A single-unit `Holy` order is **literally unpurchasable** in the live deployment.
- The only theoretical ways to sell it would be to reduce the effective basket total below `$100.00` or raise the payment threshold.
- The final remaining unit is therefore **dead inventory**, not usable inventory.

Commercial impact:

- Trapped inventory value: **$99.99**
- Historical sell-through: **0 units across 66 orders**
- Category distortion: the `magic` tag shows stock on hand, but none of it is monetizable under the current payment rule.

---

## 7. Replenishment Recommendations

### 7.1 Immediate Actions

1. `Holy`: do **not** restock yet. Fix the payment/pricing defect first, because adding units would only increase dead inventory.
2. No other SKU requires emergency replenishment. Every demand-active item has more than 698 orders of observed cover.

### 7.2 Demand-Driven Restock View

- No SKU currently justifies a demand-driven reorder.
- Highest-volume SKUs are `SuperSport XL`, `Crossed`, `Classic`, `Cat socks`, and `YouTube.sock`, but each is already carrying excessive stock relative to observed demand.

### 7.3 Overstock Risk

Most overstocked sellable items by estimated order cover:

| Product | Current Stock | Units Sold | Estimated Orders Remaining |
|---------|---------------|------------|----------------------------|
| Figueroa | 808 | 10 | 5332.80 |
| YouTube.sock | 801 | 11 | 4806.00 |
| Colourful | 438 | 7 | 4129.71 |
| Crossed | 738 | 12 | 4059.00 |
| SuperSport XL | 820 | 14 | 3865.71 |
| Nerd leg | 115 | 6 | 1265.00 |
| Cat socks | 175 | 11 | 1050.00 |
| Classic | 127 | 12 | 698.50 |

### 7.4 Recommended Reorder Quantities

Reorder model: target a 60-order stock cover based on current demand velocity. Under that rule, every SKU already exceeds target stock, so no replenishment order is warranted today.

| Product | Current Stock | Target Stock for 60 Orders | Recommended Reorder Qty |
|---------|---------------|----------------------------|-------------------------|
| Holy | 1 | 0 | 0 |
| Colourful | 438 | 7 | 0 |
| SuperSport XL | 820 | 13 | 0 |
| Crossed | 738 | 11 | 0 |
| Figueroa | 808 | 10 | 0 |
| Cat socks | 175 | 11 | 0 |
| Nerd leg | 115 | 6 | 0 |
| YouTube.sock | 801 | 11 | 0 |
| Classic | 127 | 11 | 0 |

Recommendation summary:

- Prioritize sell-through and assortment cleanup over procurement.
- Resolve `Holy` first by either lowering its effective checkout total below `$100.00` or increasing the payment ceiling.
- Freeze replenishment on the rest of the catalogue until order velocity grows materially.

---

## 8. Inventory Health Scorecard

| Metric | Value |
|--------|-------|
| Overall inventory health | **AMBER** |
| Total catalogue value | **$58,248.99** |
| Dead inventory value | **$99.99** |
| Active inventory value | **$58,149.00** |

Why `AMBER` instead of `GREEN`:

- Supply continuity is strong: no sellable SKU is close to running out.
- Inventory efficiency is weak: the catalogue is broadly overstocked against current order velocity.
- `Holy` is a confirmed dead-inventory defect caused by the live payment threshold and shipping combination.

## 9. Key Findings

1. The catalogue is not facing a replenishment crisis; it is facing an efficiency problem.
2. `Holy` is the only `CRITICAL` stock item, but the real issue is not scarcity, it is unsellability.
3. Cheaper items generally sell more often in this environment, with a strong negative price-demand correlation of `-0.7885`.
4. `Classic` and `Cat socks` are the best balance of revenue generation and inventory efficiency.
5. No SKU should be reordered today under a 60-order stock-cover policy.
