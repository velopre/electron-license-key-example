# Electron License Key Verification Example (Offline-Ready)

A minimal, secure implementation of node-locked license key validation in Electron using [Keyfern](https://keyfern.com).

It verifies licenses cryptographically using **Ed25519 signatures**, allowing your desktop app to launch instantly and work completely **offline** for the duration of a lease (e.g., 30 days) without risking local proxy spoofing.

---

## Why Cryptographic Signatures?

Most desktop apps implement licensing by sending an HTTP request and checking `{ "valid": true }`. Anyone can bypass that check by adding an entry to `/etc/hosts` or running a local proxy like mitmproxy.

Keyfern solves this:
1. **Asymmetric Signing:** The server signs every activation with the product's Ed25519 Private Key.
2. **Local Public Key:** The Electron app embeds only the **Public Key**. Even if network traffic is intercepted, a fake server cannot forge a valid Ed25519 signature.
3. **Offline Leases:** Once activated, the app caches the signed lease. Subsequent app launches check the signature against local time without contacting the server.
4. **Clock Rollback Protection:** The local lease manager detects if the system clock has been tampered with.

*Note: In Keyfern, offline mode is disabled by default (`lease_days = 0`). To enable offline usage, configure a lease duration (e.g., 30 days) in your Product settings in the Keyfern dashboard.*

---

## Prerequisites

- Node.js 20+
- A free Keyfern account ([https://keyfern.com](https://keyfern.com))
- A Product created in the Keyfern Dashboard (copy your `Product ID` and `Public Key`)

---

## Quickstart

### 1. Clone the repository
```bash
git clone https://github.com/keyfern/electron-license-key-example.git
cd electron-license-key-example
```

### 2. Install dependencies
```bash
npm install
```
The Keyfern SDK is not on the public npm registry; `package.json` installs it from `https://keyfern.com/dl/keyfern-1.0.0.tgz`.

### 3. Configure your keys
Copy the sample environment file:
```bash
cp .env.example .env
```
Open `.env` and fill in your values from the Keyfern Dashboard:
```ini
KEYFERN_PRODUCT_ID="prod_your_product_id"
KEYFERN_PUBLIC_KEY="your_base64url_ed25519_public_key"
```

### 4. Run the application
```bash
npm start
```

---

## Core Licensing Logic (`main.js`)

```javascript
import { Keyfern, KeyfernError, fileStorage, machineId } from 'keyfern';
import { app } from 'electron';
import os from 'node:os';
import path from 'node:path';

const licensing = new Keyfern({
  product: process.env.KEYFERN_PRODUCT_ID,
  publicKey: process.env.KEYFERN_PUBLIC_KEY,
  // The signed license is saved here after every successful activation
  storage: fileStorage(path.join(app.getPath('userData'), 'license_lease.json')),
});

const machine = await machineId();

// 1. Initial Activation (Requires Internet)
async function activateLicense(licenseKey) {
  try {
    // Verifies the Ed25519 signature, then caches the signed payload
    const lic = await licensing.activate(licenseKey, machine, os.hostname());
    return { success: true, leaseUntil: lic.lease_until };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// 2. Launch Verification (Works 100% Offline if lease is configured)
async function verifyLicenseOnStartup() {
  try {
    // Checks signature, machine, expiry, lease and clock rollback. No network.
    const lic = await licensing.cached(machine);
    return { licensed: true, offline: lic.lease_until != null, expiresAt: lic.lease_until };
  } catch (err) {
    if (err instanceof KeyfernError) {
      // no_cache, lease_expired, expired, clock_rollback, bad_signature ...
      return { licensed: false, reason: err.code };
    }
    throw err;
  }
}
```

---

## Features

- **Node-Locking:** Limit the number of machines per license key.
- **Floating Licenses:** Allow machines to unregister on exit to free seats for other workstations.
- **Machine-Locked Free Trials:** Grant a one-time trial per hardware ID with automatic expiration.
- **Feature Flags (F1–F8):** Toggle features per license key inside the signed payload.
- **Stripe Integration:** Deliver keys automatically after checkout with zero percent commission from Keyfern.

---

## Pricing

Keyfern offers flat pricing based on total keys created—never per API request:
- **Free:** $0/mo for 1 product and up to 50 keys (no credit card required).
- **Starter:** $10/mo for 2 products, 1,000 keys, and direct Stripe integration.
- Full details: [https://keyfern.com](https://keyfern.com)

---

## License

MIT
