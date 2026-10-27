# Turning on accounts, sync and email updates

Pick-A-Card works without any of this: your cards are saved on the device. Accounts add:

- **Sign in** with Google, or with an email and password.
- **Sync** of your cards, point values and spending log across every phone and browser you sign in on.
- **Two email lists**, each person choosing in Settings:
  - *My cards*: emails when a card in your wallet changes. That includes new rotating categories, earn rates, and benefits added or removed.
  - *All card news*: emails about any card change, plus new cards and discontinued cards.

It uses **Firebase**, Google's free app backend. The free "Spark" plan is plenty, so no credit card is needed. Setup takes about 15 minutes, once.

## 1. Create the Firebase project (~5 min)

1. Go to <https://console.firebase.google.com> and sign in with your Google account.
2. **Create a project** → name it `pick-a-card` → you can turn off Google Analytics → **Create**.

## 2. Turn on sign-in

1. In the left menu: **Build → Authentication → Get started**.
2. On the **Sign-in method** tab:
   - **Google** → Enable → pick your email as the support email → **Save**.
   - **Email/Password** → Enable → **Save**. (The passwordless "Email link" option isn't needed.)
3. On the **Settings** tab → **Authorized domains** → **Add domain** → `manmeyco.github.io`.

## 3. Create the database

1. **Build → Firestore Database → Create database**.
2. Pick a location near you (e.g. `nam5 (United States)`), then **Start in production mode** → **Create**.
3. The security rules (each person can only read and write their own data) are installed automatically from [`firestore.rules`](firestore.rules) by the **Deploy Firestore rules** GitHub Action once the `FIREBASE_SERVICE_ACCOUNT` secret from step 5 is set. To install them by hand instead, paste that file into the **Rules** tab and click **Publish**.

## 4. Connect the app

1. Click the ⚙️ next to **Project Overview** → **Project settings**.
2. Under **Your apps**, click the **Web** icon (`</>`), name it `Pick-A-Card` (no Hosting needed) → **Register app**.
3. You'll see a block like `const firebaseConfig = { apiKey: "...", authDomain: "...", ... }`.
   **Send that block to Claude**, or paste it into [`js/firebase-config.js`](js/firebase-config.js) in place of `null`.
   It's safe to share: Firebase web configs are public by design, and access is controlled by the rules from step 3.

Once that's deployed, **Settings → Account** in the app shows **Sign in with Google** and **Email me a sign-in link**.

## 5. Turn on the update emails (~5 min)

Emails go out from a GitHub Action whenever the card data changes. It needs three GitHub secrets.

**A. Firebase key (to read who's subscribed)**
1. Firebase **Project settings → Service accounts → Generate new private key** → this downloads a `.json` file.
2. On GitHub, open <https://github.com/Manmeyco/credit-card-picker/settings/secrets/actions> → **New repository secret**.
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Value: the entire contents of that `.json` file.
3. Delete the downloaded file afterwards. Keep this key private and never commit it.

**B. A Gmail account to send from**
Use a dedicated Gmail account for the app rather than your personal one, because subscribers see it as the sender.
1. That Google account needs **2-Step Verification** turned on: <https://myaccount.google.com/security>.
2. Create an **app password**: <https://myaccount.google.com/apppasswords> → name it `Pick-A-Card` → copy the 16-character password.
3. Add two more GitHub secrets:
   - `GMAIL_USER`: the Gmail address
   - `GMAIL_APP_PASSWORD`: the 16-character app password

Gmail allows about 500 emails a day, which is plenty for a personal or small-group app. Without these secrets, the email job still runs but only logs what it *would* have sent.

## How it works

| Piece | Where |
|---|---|
| Sign-in + sync | `js/cloud.js` (Firebase loads only when configured) and `js/sync-merge.js` |
| Who can read what | `firestore.rules`: each person can access only `users/<their id>` |
| Email content | `scripts/card-diff.mjs` compares the old and new `data/cards.json` |
| Sending | `scripts/notify.mjs`, run by `.github/workflows/notify.yml` |

Each person's Firestore document stores their synced data, their email address, the list of card IDs in their wallet (used for the "My cards" list), and their two email preferences. Everyone can switch either list off in **Settings → Account**, and every email links there.
