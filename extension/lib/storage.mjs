import { KEY, createStore, validateStore } from './schema.mjs';
export const isExtension = Boolean(globalThis.chrome?.storage?.local && globalThis.chrome?.runtime?.id);
export async function readStore() {
  const raw = isExtension ? (await chrome.storage.local.get(KEY))[KEY] : JSON.parse(localStorage.getItem(KEY) || 'null');
  return raw ? validateStore(raw) : createStore();
}
export async function saveStore(store) {
  if (isExtension) await chrome.storage.local.set({ [KEY]: store });
  else localStorage.setItem(KEY, JSON.stringify(store));
}
export function downloadStore(store) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: `简历匣备份-${new Date().toISOString().slice(0, 10)}.json` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
