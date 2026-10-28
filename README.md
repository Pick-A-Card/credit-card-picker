# Pick-A-Card

A phone-friendly web app that tells you which card to use for a purchase. It fixes two problems with Credit Karma's version:

1. **Rotating categories.** Discover it and Chase Freedom quarterly categories are built in. The app tracks whether you activated each quarter and how much of the $1,500 cap you've used.
2. **Points aren't all worth the same.** Each rewards currency has a cents-per-point value *you* set. Restricted points (like GM Rewards) don't beat real cash back, and hotel and airline points use realistic values.

Other features:

- **📍 What card here?** Uses your phone's GPS and OpenStreetMap data (via Photon, with Overpass and Nominatim as backups) to find the store you're in, then ranks your cards for it. It recognizes hotel sub-brands too: a Hampton Inn counts as Hilton, a Courtyard as Marriott.
- **Store-specific deals.** Partner bonuses like Sapphire Preferred 5x at Lyft, travel-portal multipliers and co-brand hotel/airline bonuses count when you're at that merchant. When you pick a general category, a "Better at specific places" hint shows them. For example, Rideshare shows "Lyft: Sapphire Preferred 5%".
- **Benefits that tip the decision.** Rental car insurance, cell phone protection, trip delay, lounge access and credits show up as 💡 tips and break ties.
- **Traveling abroad.** The app notices when you're outside the US and subtracts foreign transaction fees.
- **130 credit and debit cards** from 25+ issuers. Pick by issuer, search, or filter to debit cards (PayPal, Cash App, Venmo, Discover). You can also add any card yourself.
- Spending caps per month/quarter/year, "pick your category" cards, and store payment rules (Costco only takes Visa in store).
- **Automatic updates.** Card terms and rotating categories update by themselves, with a "what changed" notice and Undo.
- **Accounts (optional).** Sign in to sync your cards across devices and get email updates. This needs a one-time setup: see [SETUP-ACCOUNTS.md](SETUP-ACCOUNTS.md).
- Works offline except the store lookup. Without an account, everything stays on your device; use Export/Import in Settings for backups.

## Install on Android

1. Open **https://manmeyco.github.io/credit-card-picker/** in **Chrome**.
2. Tap **⋮ → Add to Home screen → Install**.
3. *(Optional one-tap button)* Long-press the app icon and drag the **"What card here?"** shortcut onto your home screen.

Then add your cards in **Wallet → ＋ Add cards**, and set what your points are worth in **Settings**. Tick **Activated** on rotating-category cards once you've activated the quarter with your bank.

About widgets: a web app can't add a real Android home-screen widget. The launcher shortcut is the closest thing.

## How card data stays current

- Card terms live in [`data/cards.json`](data/cards.json). The app re-checks it every time it opens.
- A scheduled Claude routine follows [`UPDATING.md`](UPDATING.md) on the 16th of every month and on the 1st of each quarter. It checks:
  - rotating categories
  - earn rates and caps
  - benefits and partner deals
  - new and discontinued cards

  It also verifies cards still marked "terms not yet verified". It publishes only if the data checks (`npm test`) pass.
- Cards you've edited yourself are never overwritten; you get "Use the update / Keep mine" instead.
- When accounts are set up, subscribers get emails about these changes ([details](SETUP-ACCOUNTS.md)).

## Support & contact

Pick-A-Card is free, with no ads. If it's useful, you can [buy me a coffee ☕](https://buymeacoffee.com/pickacard).
Questions, or a card that's wrong or missing: **pickacreditcard@gmail.com**

## Privacy

Your cards, spending log and settings stay on your phone, or in your own Firebase account if you turn on sync. When you tap **What card here?**, only your location is sent, and only to these US/EU-based services:

| Service | Run by | Used for |
|---|---|---|
| Photon | komoot (Germany) | Finding nearby stores (main) |
| Overpass, overpass-api.de | OpenStreetMap volunteers (Germany) | Backup store lookup |
| Nominatim | OpenStreetMap Foundation (UK) | Last-resort backup |
| gstatic.com | Google (US) | Internet check after a failed lookup (no location sent) |

## Development

No build step. Plain HTML/CSS/ES modules.

```sh
npm start    # serves on http://localhost:8080
npm test     # ranking, sync, email-diff and card-data validation tests (Node 20+)
```

| File | What it does |
|---|---|
| `data/cards.json` | Cards, benefits, rotating quarters, partner deals, point currencies, changelog |
| `js/engine.js` | Ranking: earn rate × point value, caps, rotating quarters, store deals, foreign fees, benefit tie-breaks |
| `js/data.js` | Categories, merchant directory (each merchant also gets an `m:<id>` category), OpenStreetMap mapping |
| `js/catalog.js`, `js/sync.js` | Load card data and apply updates to your wallet (auto-update, undo, keep-mine) |
| `js/cloud.js`, `js/sync-merge.js`, `js/firebase-config.js` | Optional accounts and cross-device sync |
| `js/location.js` | GPS + Overpass lookup of nearby stores; abroad detection |
| `scripts/card-diff.mjs`, `scripts/notify.mjs` | Email updates when card data changes |
| `js/store.js`, `js/app.js` | Local storage and UI |

Store data © OpenStreetMap contributors.
