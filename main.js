import { app, BrowserWindow, ipcMain } from 'electron';
import { Keyfern, KeyfernError, fileStorage, machineId } from 'keyfern';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Optional .env (Node 20.6+); real environment variables win.
try { process.loadEnvFile(); } catch { /* no .env file */ }

const here = path.dirname(fileURLToPath(import.meta.url));
let licensing;   // created after app is ready (userData path needs it)
let machine;

const DAY = 86400;

// Verified, signed license -> UI status. Offline leases carry lease_until.
function toStatus(lic) {
  if (lic.lease_until == null) return { state: 'valid' };
  const days = Math.max(0, Math.ceil((lic.lease_until - Date.now() / 1000) / DAY));
  return { state: 'offline', days };
}

function toError(e) {
  if (e instanceof KeyfernError) {
    const hint = e.code === 'lease_expired'
      ? 'Offline lease expired: connect to the internet and activate again.'
      : e.message;
    return { state: 'unlicensed', code: e.code, error: hint };
  }
  return { state: 'unlicensed', code: 'network', error: e.message };
}

// Startup check: signature, machine, expiry, lease and clock rollback, no network.
async function checkCached() {
  try {
    return toStatus(await licensing.cached(machine));
  } catch (e) {
    if (e instanceof KeyfernError && e.code === 'no_cache') return { state: 'unlicensed' };
    return toError(e);   // lease_expired, expired, clock_rollback, bad_signature, wrong_machine...
  }
}

ipcMain.handle('license-status', checkCached);

// Online activation. The SDK verifies the Ed25519 signature, then stores the
// signed payload in userData/license_lease.json.
ipcMain.handle('activate-license', async (_e, key) => {
  try {
    const lic = await licensing.activate(String(key).trim(), machine, os.hostname());
    const status = toStatus(lic);
    if (status.state === 'valid') {
      status.note = 'Offline use is off (lease_days = 0). Set a lease duration in the Keyfern dashboard to allow it.';
    }
    return status;
  } catch (e) {
    return toError(e);
  }
});

app.whenReady().then(async () => {
  licensing = new Keyfern({
    product: process.env.KEYFERN_PRODUCT_ID,
    publicKey: process.env.KEYFERN_PUBLIC_KEY,
    storage: fileStorage(path.join(app.getPath('userData'), 'license_lease.json')),
  });
  machine = await machineId();

  const win = new BrowserWindow({
    width: 550,
    height: 420,
    resizable: false,
    backgroundColor: '#0f1115',
    webPreferences: { preload: path.join(here, 'preload.cjs') },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(here, 'index.html'));
});

app.on('window-all-closed', () => app.quit());
