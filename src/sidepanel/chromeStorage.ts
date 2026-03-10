import { defaultSettings } from "./defaultSettings";
import type { Settings } from "./types";

export async function loadSettings(): Promise<Settings> {
  return chrome.storage.local.get(defaultSettings) as Promise<Settings>;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.local.set(settings);
}
