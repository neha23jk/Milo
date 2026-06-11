import { load, type Store } from "@tauri-apps/plugin-store";
import type { LlmProviderId } from "@/types";

/**
 * Secure-ish local storage for the BYOK API key, kept out of the SQLite DB.
 * Stored in `secrets.json` in the app data dir via tauri-plugin-store.
 */
let storePromise: Promise<Store> | null = null;

function getStore(): Promise<Store> {
  if (!storePromise) {
    storePromise = load("secrets.json", { autoSave: true, defaults: {} });
  }
  return storePromise;
}

const keyName = (provider: LlmProviderId) => `apiKey:${provider}`;

export async function setApiKey(
  provider: LlmProviderId,
  key: string,
): Promise<void> {
  const store = await getStore();
  await store.set(keyName(provider), key);
  await store.save();
}

export async function getApiKey(
  provider: LlmProviderId,
): Promise<string | null> {
  const store = await getStore();
  const value = await store.get<string>(keyName(provider));
  return value ?? null;
}

export async function hasApiKey(provider: LlmProviderId): Promise<boolean> {
  const key = await getApiKey(provider);
  return !!key && key.trim().length > 0;
}

export async function clearApiKey(provider: LlmProviderId): Promise<void> {
  const store = await getStore();
  await store.delete(keyName(provider));
  await store.save();
}
