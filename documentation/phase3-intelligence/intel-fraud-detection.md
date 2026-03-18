# Sock Shop Fraud & Anomaly Detection Report

Live API assessment against `http://localhost:8888` on 2026-03-17.

## 5a. Data Exposure Assessment

The Sock Shop front end exposes sensitive customer data without authentication:

- `GET /customers` returned 5 customer records with usernames, names, and internal customer IDs.
- `GET /cards` returned 4 card records with full PANs, expiry dates, and `ccv` values.
- `GET /addresses` returned 4 address records with street, house number, city, postcode, and country.

This is an immediate data-harvesting path for any unauthenticated caller. The card exposure is a direct PCI-DSS failure because the API returns full payment card numbers and CVV/CCV values in plaintext. CVV data must not be stored after authorization, and it must never be disclosed to unauthenticated users.

Observed exposure counts:

| Dataset | Endpoint | Auth Required | Exposed Records | Notes |
|---|---|---:|---:|---|
| Customers | `GET /customers` | No | 5 | Includes 3 seeded users plus 2 test accounts |
| Cards | `GET /cards` | No | 4 | Full PAN, expiry, and CVV exposed |
| Addresses | `GET /addresses` | No | 4 | Full postal address data exposed |

Impact:

- An external attacker can enumerate customers and correlate them with payment cards and delivery addresses.
- The leaked card corpus includes enough information for card testing, credential stuffing, and identity fraud.
- The exposure is systemic, not tied to a single account, because the endpoints are globally readable.

## 5b. Card Fraud Indicators

All 4 stored cards are expired as of 2026-03-17. Three cards expired in `08/19`; one additional card expired in `04/16`.

Card validation results:

| Owner | Card ID | Number | Format Assessment | Expired | Notes |
|---|---|---|---|---|---|
| `Eve_Berger` | `57a98d98e4b00679b4a830ae` | `5953580604169678` | Valid 16-digit Mastercard | Yes | Last 4 confirmed via authenticated `GET /card` |
| `user` | `57a98d98e4b00679b4a830b1` | `5544154011345918` | Valid 16-digit Mastercard | Yes | Used in every observed order |
| `user1` | `57a98d98e4b00679b4a830b4` | `0908415193175205` | Invalid prefix (`0`) | Yes | Clearly malformed payment instrument |
| Unknown owner | `57a98ddce4b00679b4a830d2` | `5429804235432` | Invalid Mastercard length (13 digits) | Yes | Orphaned card record |

Fraud indicators:

- Expired cards: `4/4` cards are expired.
- Invalid card formats: `2/4` cards are malformed.
- Duplicate card numbers across different users: none observed.
- Order-to-card consistency: all 66 observed orders used `user`'s on-file card `5544154011345918`; no mismatches were observed in current order history.

Assessment:

- The most serious control failure is not just bad card hygiene, but the fact that the platform stores and serves unusable and expired cards as if they were valid payment instruments.
- `user1` already has a card that should fail basic issuer-format validation before it ever reaches storage.
- The orphan 13-digit Mastercard-shaped record indicates weak data integrity controls in addition to weak security controls.

## 5c. Address Anomalies

The address dataset contains both identity-correlation risk and data-quality issues.

Shared-address findings:

| Normalized Address | Linked Users | Linked Cards | Finding |
|---|---|---|---|
| `246 Whitelees Road, Glasgow, G67 3DL, United Kingdom` | `user`, `Eve_Berger` | `...5918`, `...9678` | Shared address across two accounts and two cards |
| `4 Maes-Y-Deri, Aberdare, CF44 6TF, United Kingdom` | `user1` | `...5205` | Single-user address |
| `3 my road, London, UK` | Unknown | Unknown | Incomplete orphan record |

Address completeness:

- `3/4` address records are complete across `street`, `number`, `city`, `postcode`, and `country`.
- `1/4` address records is incomplete: address `57a98ddce4b00679b4a830d1` has an empty postcode.

Assessment:

- The shared Glasgow address may be benign, but in fraud analysis it creates account-linkage risk because two different accounts are tied to the same location and two different cards.
- The incomplete London address is likely test or orphaned data and indicates weak validation on stored customer records.
- Address data is globally readable, so even the benign records can be used for doxxing, impersonation, or carding workflows.

## 5d. Order Fraud Signals

Authenticated order pulls produced 66 orders for `user`, 0 for `user1`, and 0 for `Eve_Berger`.

Core order signals:

| Check | Result | Evidence |
|---|---|---|
| Duplicate timestamps | Present | 16 distinct timestamp collisions; 43 orders share a timestamp with at least one other order |
| Exact duplicate order shapes | Present | 16 duplicated order shapes, including 5 identical `SuperSport XL` orders at `2026-03-16T18:54:48.327+0000` |
| Rapid successive orders | Present | 59 inter-order gaps under 1 second; 63 under 5 seconds |
| Zero-item orders | Present | 6 orders contained 0 items but still produced a `4.99` total |
| Near-threshold totals | Not observed | 0 orders between `95.00` and `99.99` |
| Repeated item patterns | Present | High repetition of the same SKUs and small item combinations |
| Broken entity references | Not observed | 0 orders referenced missing customers, cards, or addresses |

Timing pattern:

- Burst 1: 20 orders in the `18:52` minute.
- Burst 2: 45 orders in the `18:54` minute.
- Residual activity: 1 additional order at `20:11:34.375+0000`.

Most repeated purchased items by quantity:

| Item | Quantity |
|---|---:|
| `SuperSport XL` | 14 |
| `Crossed` | 12 |
| `Classic` | 12 |
| `Cat socks` | 11 |
| `YouTube.sock` | 11 |
| `Figueroa` | 10 |

Most repeated order shapes:

- `Crossed` only: 7 orders
- `Classic` only: 7 orders
- `Cat socks` only: 7 orders
- `SuperSport XL` only: 7 orders
- Empty cart / zero-item orders: 6 orders

Assessment:

- The timestamp collisions and sub-second bursts are consistent with automated checkout activity, replayed requests, or duplicate order submission logic.
- The zero-item orders are a strong abuse signal because they still generated billable totals (`4.99`) despite having no merchandise.
- Current order records are internally consistent with the leaked customer, card, and address data, which means the issue is not broken references; it is weak validation and weak anti-abuse controls.

## 5e. User Risk Profiles

### `user`

| Signal | Value |
|---|---|
| Total orders / spend | `66` orders / `1491.01` total spend |
| Card validity | Expired `08/19`; valid Mastercard format; used in all 66 orders |
| Address verification | Address matches stored record, but the same address is also used by `Eve_Berger` |
| Order pattern | Highly suspicious: 43 orders with duplicate timestamps, 59 sub-second gaps, 6 zero-item orders |
| Risk score | `CRITICAL` |

Reasoning: `user` accounts for all observed order volume, all observed spend, every zero-item order, and every automation-like burst. This is either a compromised account, a scripted test harness operating against production-like data, or both.

### `user1`

| Signal | Value |
|---|---|
| Total orders / spend | `0` orders / `0.00` spend |
| Card validity | Expired `08/19`; invalid prefix (`0`) |
| Address verification | Address is complete and unique to the account |
| Order pattern | No current order activity |
| Risk score | `HIGH` |

Reasoning: there is no active transactional abuse right now, but the account holds a malformed and expired card that should never have passed basic validation. If checkout were attempted, the current payment path appears likely to accept it.

### `Eve_Berger`

| Signal | Value |
|---|---|
| Total orders / spend | `0` orders / `0.00` spend |
| Card validity | Expired `08/19`; valid Mastercard format |
| Address verification | Address is complete but shared with `user` |
| Order pattern | No current order activity |
| Risk score | `MEDIUM` |

Reasoning: there is no order activity to indicate active fraud from this account, but the expired card is still stored, and the shared address links this account to the platform's only active order source.

## 5f. Cross-Domain Correlation

Catalogue and payment correlation:

- The `Holy` sock is priced at `99.99`.
- Observed shipping is a fixed `4.99` on normal orders.
- A single-item `Holy` order would therefore total `104.98`, which exceeds the known `100.00` payment threshold.
- No orders containing `Holy` were observed, and no `Holy`-only orders were observed. That is consistent with the threshold rule and confirms that this item is effectively unpurchasable on its own.

Payment-control correlation:

- Every stored card is expired, yet 66 orders were still processed for `user`.
- This shows the payment path is evaluating amount constraints while ignoring card expiry validity.
- In practice, the system treats expired or malformed stored cards as acceptable checkout instruments.

Customer-concentration correlation:

- `user` accounts for `66/66` observed orders and `1491.01/1491.01` observed spend.
- `user1` and `Eve_Berger` had no orders at the time of collection.
- That concentration is inconsistent with normal multi-user storefront traffic and is more consistent with a single scripted actor, a compromised account, or both.

## 5g. Fraud Summary & Risk Matrix

Severity counts:

| Severity | Count | Findings |
|---|---:|---|
| Critical | 3 | Public access to sensitive datasets; full PAN/CVV disclosure and storage; expired cards accepted for checkout |
| High | 4 | Automated order bursts; zero-item orders charged; all order activity concentrated on one account; invalid stored card records |
| Medium | 2 | Shared address across two accounts and two cards; incomplete orphan address data |
| Low | 0 | No low-severity-only findings were retained after triage |

Top 3 urgent findings:

1. `GET /cards` exposes full PAN, expiry, and CVV data without authentication. This is the highest-impact breach and should be treated as active compromise.
2. The checkout flow processed 66 orders in 2026 using a card that expired in `08/19`, proving payment validation does not reject expired cards.
3. The `user` account generated all observed spend in highly automated bursts, including 6 zero-item orders, which strongly suggests abuse or replayed order submission.

Recommended immediate actions:

1. Remove public access to `GET /customers`, `GET /cards`, and `GET /addresses` immediately; require authenticated, authorized access and assume the exposed data is already compromised.
2. Disable checkout until PAN/CVV storage is eliminated, CVV data is purged, and payment validation rejects expired or malformed cards before order creation.
3. Freeze and review the `user` account and its recent orders, especially the duplicate timestamp clusters and zero-item transactions, for automated abuse and chargeback exposure.

Checks with no current finding:

- No duplicate PAN values were observed across different card records.
- No orders near the `100.00` threshold were observed.
- No `Holy`-item orders were observed, so the known threshold issue is currently blocked by pricing rather than being actively exploited.
