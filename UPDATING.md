# Updating card data

The app reads card terms from `data/cards.json` every time it opens. A scheduled Claude routine
follows this file to keep that data current. A person can follow it too.

## When the routine runs

- On the 16th of every month, when rotating categories for the next quarter are usually out.
- On the 1st of January, April, July and October, to confirm the new quarter.

## What to check

1. **Rotating categories.** These are for every card with a `rotating` block (Discover it, Chase
   Freedom Flex). Add the **current and next quarter** as soon as they are announced. Fix any
   quarter that is wrong.
2. **Verify unverified cards.** Cards without a `verified` date were added from general knowledge
   and have not been checked against 2026 sources. Each run, verify up to 25 of them, starting
   with the most popular. Fix anything wrong, then set `verified` to today's date. If you fixed
   anything, bump `version` so wallets pick up the fix. Add a changelog entry only if the terms
   actually changed recently; a correction alone shows people a quiet "details refreshed" notice
   and sends no email.
3. **New cards and discontinuations.** Search for notable credit and debit card launches and
   discontinuations from the last ~2 months. Add notable new cards, with `verified` set. Mark
   cards closed to new applicants with `"discontinued": "YYYY-MM-DD"`, plus a version bump and
   changelog entry. These changes drive the "All card news" email list.
4. **Every verified card in `data/cards.json`, one at a time.** Run at least one search per card (e.g. "<card name> changes <current year>"). A single broad search for all cards is not enough. If a search hints at a change, follow it up and confirm it, or list it as unconfirmed. Look for changes from the last ~3 months:
   - Earn rates, bonus categories, spending caps, cap periods.
   - Benefits added or removed: purchase/travel/rental-car/cell-phone protection, statement
     credits, TSA PreCheck / Global Entry credits, lounge access, reimbursements.
   - **Merchant partnerships and side deals** that tip a purchase toward one card. Examples: Chase ×
     Lyft (5x Sapphire Preferred), DashPass, Uber Cash, and travel-portal multipliers (Chase
     Travel, Capital One Travel, Amex Travel). Model them as rules on `m:<merchant id>`
     categories. Use `until` for promotions that end.
   - Foreign transaction fees (`foreignFee`) and annual fees (`annualFee`).
   - Renames, a new issuer or network, or the card being discontinued or replaced.
   - Point values only matter for **new** currencies. Never change `cpp` on an existing currency;
     the app keeps each person's own values anyway.

### Sources

Prefer the issuer's own pages and press releases. Otherwise use **two** independent reputable
sources (NerdWallet, Doctor of Credit, The Points Guy, Frequent Miler, Bankrate, CNBC Select,
Thrifty Traveler, InsideFlyer). Do not change data on a single unofficial source or a rumor. List
anything uncertain in the run summary instead.

## How to edit `data/cards.json`

- Card shape: `presetId`, `issuer`, `type` (credit|debit), `name`, `short`, `network`
  (visa|mastercard|amex|discover), `currency` (a key of `currencies`), `color`, `base`, `rules`,
  optional `rotating`, `benefits`, `annualFee`, `foreignFee` (percent; omit if unknown),
  `verified`, `discontinued`, `version`, `changelog`.
- Rule: `{ "cats": [...], "rate": n, "cap"?: { "amount", "period": month|quarter|year, "group"? }, "label"?, "choiceOptions"?, "until"?: "YYYY-MM-DD" }`.
  `rate` is points (or %) per dollar. Rules that share a cap use the same `cap.group`.
- Valid categories are the ids in `CATEGORIES` in `js/data.js`. `"@travel"` is shorthand for all
  travel categories. `"m:<merchant id>"` targets one merchant (ids are the merchant names in
  `MERCHANTS` in `js/data.js`, lower-cased with non-letters replaced by `_`, e.g. `m:lyft`,
  `m:hilton`, `m:chase_travel_portal`). If a merchant is missing, add it to `MERCHANT_LIST` in
  `js/data.js`, the one code change allowed in a data update. Map issuer wording to the closest category. If no category fits, say so in
  the summary rather than inventing one.
- Rotating quarter: `"YYYY-Qn": { "cats": [...], "rate": 5, "rates"?: { "dining": 7 } }`.
  **Match the issuer's wording exactly.** If the bonus is for one merchant (e.g. "American Red
  Cross", "Amazon.com", "PayPal"), use that merchant's `m:<id>` category, not the general
  category (`charity`, `online`). Otherwise the app awards the bonus at every store in that category.
  `rates` must reflect each card's own base rates: Freedom Flex's 7% dining comes from its 3%
  dining plus the 4% bonus; the legacy Freedom gets a flat 5%.
  `rates` overrides the rate for specific categories, as with Freedom Flex dining, which stacks
  to 7x. Adding or fixing a quarter needs **no** version bump; it reaches every phone
  automatically.
- Benefit: `{ "text": "...", "cats"?: [...] }`. Give `cats` when the benefit matters for a
  purchase type, such as rental car insurance → `car_rental`, cell phone protection →
  `utilities`, or trip delay → `airfare`. The app shows it as a tip and uses it to break ties.
- **When a card's terms or benefits change:**
  1. Edit the card.
  2. Set its `version` to today's date (`YYYY-MM-DD`). If it is already today's date, append
     `.2`, `.3`, …
  3. Add a `changelog` entry `{ "date": <same as version>, "text": "..." }`. Write one or two
     plain-English sentences for the cardholder, e.g. "Now 3x on gas. Lost the $10/month
     dining credit." People see this text in the app, with an Undo button.
  4. Set the top-level `updated` to today's date.
- If a card is discontinued, keep it, because people may still hold it, and add a changelog
  entry saying so. If it is replaced by a new product, add the new card as a separate preset.
- Do not edit app code (`js/`, `css/`, `index.html`) during a data update, except to add merchants to `MERCHANT_LIST`.

## Before publishing

```sh
npm test   # must pass: validates every card, category, cap and changelog entry
```

Commit only `data/cards.json` (and `js/data.js` if you added merchants), with a message like `Card data update 2026-11-16: Discover Q1 2027
categories; Amex Gold dining credit change`. Push to the repository's **default branch**. GitHub
Pages redeploys, and phones pick up the change the next time the app opens. If nothing changed,
do not commit.
