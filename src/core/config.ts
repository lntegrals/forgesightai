/**
 * config.ts — Persistent shop config storage.
 * Reads/writes .data/config.json, falls back to DEFAULT_SHOP_CONFIG.
 */
import fs from "fs";
import path from "path";
import { DEFAULT_SHOP_CONFIG, type ShopConfig } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

export function getShopConfig(): ShopConfig {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return { ...DEFAULT_SHOP_CONFIG };
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_SHOP_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_SHOP_CONFIG };
  }
}

export function saveShopConfig(config: ShopConfig): ShopConfig {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    console.warn("[config] Failed to save shop config:", err);
  }
  return config;
}
