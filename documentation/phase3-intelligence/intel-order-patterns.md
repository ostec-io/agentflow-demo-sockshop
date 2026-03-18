# Order Pattern Intelligence Report

Generated from live Sock Shop API snapshots captured from `http://localhost:8888/orders`, `http://localhost:8888/catalogue`, and `http://localhost:8888/catalogue/size`. Raw snapshots were saved to `/tmp/sock-shop-orders.json` and `/tmp/sock-shop-catalogue.json`.

## Executive Summary

- The dataset contains **66 orders** worth **$1491.01** in total revenue, with **$1161.67** from merchandise and **$329.34** from shipping.
- Revenue is **100% concentrated in a single customer account (`user`)**, which is a material business and fraud-risk concentration.
- Ordering activity is highly clustered: **65 of 66 orders landed between 18:52 and 18:54 UTC on 2026-03-16**, and the busiest second recorded **10 orders**.
- There are **6 empty orders**, each billed at the flat shipping rate, which inflated shipping to **22.09%** of total revenue.
- No order approached the payment rejection boundary: the highest order was **$34.99**, and there were **0 orders in the $90-$100 danger zone**.

## 5a. Order Volume Summary

| Metric | Value |
| --- | ---: |
| Total orders | 66 |
| Total revenue | $1491.01 |
| Merchandise revenue | $1161.67 |
| Average order value | $22.59 |
| Median order value | $19.99 |
| Minimum order value | $4.99 |
| Maximum order value | $34.99 |

- The median order value sits below the mean, which indicates a modest right tail driven by two-item baskets rather than high-ticket purchases.
- Six orders are exactly `$4.99`, meaning the platform accepted shipment-only checkout records with no merchandise attached.

## 5b. Product Popularity Leaderboard

### Ranked by frequency

| Rank | Product | Units sold | Orders containing product | Product revenue |
| --- | --- | ---: | ---: | ---: |
| 1 | SuperSport XL | 14 | 14 | $210.00 |
| 2 | Crossed | 12 | 12 | $207.84 |
| 3 | Classic | 12 | 12 | $144.00 |
| 4 | Cat socks | 11 | 11 | $165.00 |
| 5 | YouTube.sock | 11 | 11 | $120.89 |
| 6 | Figueroa | 10 | 10 | $140.00 |
| 7 | Colourful | 7 | 7 | $126.00 |
| 8 | Nerd leg | 6 | 6 | $47.94 |
| 9 | Holy | 0 | 0 | $0.00 |

### Ranked by revenue contribution

| Rank | Product | Product revenue | Share of merchandise revenue | Units sold |
| --- | --- | ---: | ---: | ---: |
| 1 | SuperSport XL | $210.00 | 18.08% | 14 |
| 2 | Crossed | $207.84 | 17.89% | 12 |
| 3 | Cat socks | $165.00 | 14.20% | 11 |
| 4 | Classic | $144.00 | 12.40% | 12 |
| 5 | Figueroa | $140.00 | 12.05% | 10 |
| 6 | Colourful | $126.00 | 10.85% | 7 |
| 7 | YouTube.sock | $120.89 | 10.41% | 11 |
| 8 | Nerd leg | $47.94 | 4.13% | 6 |
| 9 | Holy | $0.00 | 0.00% | 0 |

- `SuperSport XL` is the top performer on both volume (**14 units**) and revenue (**$210.00**).
- `Holy`, the catalogue outlier priced at `$99.99`, recorded **0 sales** despite being the highest-priced item.
- All order `itemId` values resolved cleanly to current catalogue records; there were **0 orphaned order items** and **0 price mismatches** versus current catalogue pricing.

## 5c. Temporal Patterns

| Time slice | Orders |
| --- | ---: |
| 2026-03-16 | 66 |

| ISO week | Orders |
| --- | ---: |
| 2026-W12 | 66 |

| Busiest minute | Orders |
| --- | ---: |
| 2026-03-16 18:54 UTC | 45 |
| 2026-03-16 18:52 UTC | 20 |
| 2026-03-16 20:11 UTC | 1 |

| Busiest second | Orders |
| --- | ---: |
| 2026-03-16 18:54:49 UTC | 10 |
| 2026-03-16 18:54:51 UTC | 10 |
| 2026-03-16 18:52:20 UTC | 6 |
| 2026-03-16 18:52:21 UTC | 6 |
| 2026-03-16 18:54:48 UTC | 5 |

- All **66 orders** occurred on **2026-03-16**, so daily and weekly seasonality cannot be inferred beyond a single burst window.
- **45 orders** were created in the `18:54` minute and **20 orders** in `18:52`; only **1 order** arrived later at `20:11`, making it a clear outlier from the main burst.
- There are **16 exact duplicate timestamps**. The most repeated timestamps are `2026-03-16T18:54:48.327+0000` and `2026-03-16T18:54:49.330+0000`, each reused **5 times**.
- The duplicate-timestamp pattern, paired with repeated identical baskets, is consistent with automated replay, batch seeding, or duplicate order creation rather than independent human checkouts.

## 5d. Basket Analysis

| Basket metric | Value |
| --- | ---: |
| Average items per order | 1.26 |
| Orders with 0 items | 6 |
| Orders with 1 item | 37 |
| Orders with 2 items | 23 |

### Most common item combinations

| Rank | Combination | Orders |
| --- | --- | ---: |
| 1 | Classic + Crossed | 5 |
| 2 | Colourful + YouTube.sock | 5 |
| 3 | Figueroa + SuperSport XL | 5 |
| 4 | Nerd leg + YouTube.sock | 4 |
| 5 | Cat socks + SuperSport XL | 2 |
| 6 | Cat socks + YouTube.sock | 2 |

- The basket mix is simple: **37 single-item orders**, **23 two-item orders**, and **6 empty orders**.
- The most common two-item baskets are `Figueroa + SuperSport XL`, `Classic + Crossed`, and `Colourful + YouTube.sock`, each appearing **5 times**.
- No baskets larger than 2 items were present, which suggests limited cross-sell depth in the captured workload.
- Empty orders are a direct anomaly: they contain no items but still carry the flat shipping charge and a completed shipment record.

## 5e. Customer Concentration

| Customer | Orders | Revenue | Share of total revenue |
| --- | ---: | ---: | ---: |
| user | 66 | $1491.01 | 100.00% |

- Unique customers placing orders: **1**.
- Revenue concentration is absolute: the `user` account generated **100%** of recorded order revenue.
- This is both a business-risk issue and a signal-quality issue: the dataset reflects one actor repeatedly ordering, so it is not representative of organic multi-customer demand.

## 5f. Shipping Analysis

| Shipping metric | Value |
| --- | ---: |
| Orders assumed to incur flat shipping | 66 |
| Shipping revenue at $4.99 per order | $329.34 |
| Shipping share of total revenue | 22.09% |
| Orders without shipment records | 0 |

- Shipping integrity is internally consistent: every order includes a shipment object, including the six empty orders.
- Shipping represents more than one fifth of all revenue because the catalogue mix is low-priced and because empty orders contribute shipping revenue without merchandise revenue.

## 5g. Payment Analysis

| Order value band | Orders |
| --- | ---: |
| Under $10 | 6 |
| $10 to < $20 | 28 |
| $20 to < $50 | 32 |
| $50 to < $90 | 0 |
| $90 to < $100 | 0 |
| $100+ | 0 |

| Metric | Value |
| --- | ---: |
| Orders in $90-$100 danger zone | 0 |
| Orders at or above $100 | 0 |
| Highest observed order total | $34.99 |

- There is no threshold pressure in this dataset. All orders sit well below the `$100` payment rejection boundary, so there is no evidence of basket-shaping to avoid payment declines.
- The value distribution is narrow: **28 orders** fall between `$10` and `< $20`, **32 orders** fall between `$20` and `< $50`, and none exceed `$50`.

## 5h. Anomalies & Red Flags

| Finding | Result |
| --- | --- |
| Empty orders | 6 orders |
| Orders with missing catalogue items | 0 items across 0 product ids |
| Orders without shipment records | 0 |
| Exact duplicate timestamps | 16 timestamp values reused |
| Order total integrity mismatches | 0 |

### Representative duplicate order signatures

| Timestamp | Count | Signature |
| --- | ---: | --- |
| 2026-03-16T18:54:48.327+0000 | 5 | `SuperSport XL` totaling `$19.99` |
| 2026-03-16T18:54:49.330+0000 | 5 | `Cat socks` totaling `$19.99` |
| 2026-03-16T18:54:51.640+0000 | 4 | `Figueroa + SuperSport XL` totaling `$33.99` |
| 2026-03-16T18:54:51.002+0000 | 3 | `EMPTY ORDER` totaling `$4.99` |
| 2026-03-16T18:54:53.479+0000 | 3 | `Figueroa` totaling `$18.99` |
| 2026-03-16T18:54:55.560+0000 | 3 | `Classic + Crossed` totaling `$34.31` |

- The most concerning integrity problem is not missing data but **duplicate behavior**: identical orders repeat at the exact same timestamp, including a shipping-only empty-order signature repeated **3 times**.
- Catalogue cross-reference is clean, which means the anomalies are concentrated in order creation patterns rather than stale product references.
- The single late order at `2026-03-16T20:11:34.375+0000` looks distinct from the main burst and may represent manual testing after the earlier batch run.
- Overall, the data resembles seeded or replayed transactional traffic more than real customer demand. Any BI decisions should treat these records as synthetic or test-biased until corroborated with broader production activity.
