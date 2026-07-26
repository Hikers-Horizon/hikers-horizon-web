/**
 * Hikers Horizon — WhatsApp Bot Blacklist Manager
 * Handles blocking and unblocking numbers.
 * Supports both Local Mode (offline JSON) and AWS Lightsail API Mode with hybrid cache fallback.
 */

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");

const LOCAL_BLACKLIST_FILE = path.join(__dirname, "blacklist.json");
const CACHE_FILE = path.join(__dirname, "blacklist_cache.json");

// Expose internal functions
module.exports = {
  isBlacklisted,
  addToBlacklist,
  removeFromBlacklist,
  getBlacklist,
  normalizeNumber,
};

/**
 * Normalizes a phone number to digits only, removing any spaces, dashes, or WhatsApp suffixes.
 * @param {string} num 
 * @returns {string}
 */
function normalizeNumber(num) {
  if (!num) return "";
  return num.replace("@c.us", "").replace(/\D/g, "");
}

/**
 * Checks if a given number is in the blacklist.
 * Automatically chooses between AWS Lightsail API mode and Local offline mode.
 * @param {string} number 
 * @returns {Promise<boolean>}
 */
async function isBlacklisted(number) {
  const cleanNum = normalizeNumber(number);
  if (!cleanNum) return false;

  const lightsailUrl = process.env.LIGHTSAIL_URL; // e.g. http://13.233.123.45:3000

  // ─── AWS LIGHTSAIL API MODE ───
  if (lightsailUrl) {
    try {
      const apiToken = process.env.BOT_API_TOKEN || "hikers_secret_token_2026";
      const response = await axios.get(`${lightsailUrl.trim()}/api/bot/check?number=${cleanNum}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
        timeout: 2000, // 2-second timeout to prevent lag
      });
      
      const isBlocked = response.data.blacklisted;
      
      // Update local offline cache in background
      updateLocalCache(cleanNum, isBlocked);
      
      return isBlocked;
    } catch (err) {
      console.warn("⚠️ AWS Lightsail API unreachable, falling back to local phone cache:", err.message);
      return checkLocalCache(cleanNum);
    }
  }

  // ─── LOCAL OFFLINE MODE (DEFAULT) ───
  return checkLocalOffline(cleanNum);
}

/**
 * Local offline check (reads from local blacklist.json)
 */
function checkLocalOffline(cleanNum) {
  const blacklist = getBlacklist();
  return blacklist.some((item) => {
    const cleanItem = normalizeNumber(item);
    if (!cleanItem) return false;

    if (cleanNum === cleanItem) return true;
    if (cleanNum.length >= 10 && cleanItem.length >= 10) {
      return cleanNum.slice(-10) === cleanItem.slice(-10);
    }
    return false;
  });
}

/**
 * Check local cached blocklist (used as a fallback when Lightsail is down)
 */
function checkLocalCache(cleanNum) {
  try {
    if (!fs.existsSync(CACHE_FILE)) return checkLocalOffline(cleanNum);
    const cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8") || "{}");
    return !!cache[cleanNum];
  } catch {
    return checkLocalOffline(cleanNum);
  }
}

/**
 * Update the local cache file
 */
function updateLocalCache(cleanNum, isBlocked) {
  try {
    let cache = {};
    if (fs.existsSync(CACHE_FILE)) {
      cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8") || "{}");
    }
    cache[cleanNum] = isBlocked;
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.error("Cache write error:", err.message);
  }
}

/**
 * Gets the current local list of blacklisted numbers.
 * @returns {string[]}
 */
function getBlacklist() {
  try {
    if (!fs.existsSync(LOCAL_BLACKLIST_FILE)) {
      fs.writeFileSync(LOCAL_BLACKLIST_FILE, JSON.stringify([], null, 2));
      return [];
    }
    const data = fs.readFileSync(LOCAL_BLACKLIST_FILE, "utf8");
    return JSON.parse(data || "[]");
  } catch (err) {
    console.error("❌ Error reading blacklist file:", err.message);
    return [];
  }
}

/**
 * Saves the local blacklist to JSON file.
 * @param {string[]} blacklist 
 */
function saveBlacklist(blacklist) {
  try {
    fs.writeFileSync(LOCAL_BLACKLIST_FILE, JSON.stringify(blacklist, null, 2));
    return true;
  } catch (err) {
    console.error("❌ Error saving blacklist file:", err.message);
    return false;
  }
}

/**
 * Adds a number to local blacklist.
 */
function addToBlacklist(number) {
  const cleanNum = normalizeNumber(number);
  if (!cleanNum) return false;

  const blacklist = getBlacklist();
  if (blacklist.includes(cleanNum)) return false;

  blacklist.push(cleanNum);
  saveBlacklist(blacklist);
  return true;
}

/**
 * Removes a number from local blacklist.
 */
function removeFromBlacklist(number) {
  const cleanNum = normalizeNumber(number);
  if (!cleanNum) return false;

  const blacklist = getBlacklist();
  const initialLength = blacklist.length;

  const filtered = blacklist.filter((item) => {
    const cleanItem = normalizeNumber(item);
    if (cleanNum === cleanItem) return false;
    if (cleanNum.length >= 10 && cleanItem.length >= 10) {
      return cleanNum.slice(-10) !== cleanItem.slice(-10);
    }
    return true;
  });

  if (filtered.length < initialLength) {
    saveBlacklist(filtered);
    return true;
  }
  return false;
}
