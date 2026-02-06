import type { BlacklistEntry } from '@/types/autofill';

const BLACKLIST_KEY = 'prewrite_blacklist';
const ALLOWLIST_KEY = 'prewrite_allowlist';

/**
 * Get blacklist from browser storage
 */
async function getBlacklist(): Promise<BlacklistEntry[]> {
  try {
    const result = await browser.storage.local.get(BLACKLIST_KEY);
    const entries = result[BLACKLIST_KEY];
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

/**
 * Get allowlist from browser storage (for non-job-portal sites user enabled)
 */
async function getAllowlist(): Promise<BlacklistEntry[]> {
  try {
    const result = await browser.storage.local.get(ALLOWLIST_KEY);
    const entries = result[ALLOWLIST_KEY];
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

/**
 * Save blacklist to browser storage
 */
async function saveBlacklist(entries: BlacklistEntry[]): Promise<void> {
  await browser.storage.local.set({ [BLACKLIST_KEY]: entries });
}

/**
 * Save allowlist to browser storage
 */
async function saveAllowlist(entries: BlacklistEntry[]): Promise<void> {
  await browser.storage.local.set({ [ALLOWLIST_KEY]: entries });
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Add URL to blacklist (disable for job portal site)
 */
export async function addToBlacklist(url: string, type: 'page' | 'domain' = 'page'): Promise<void> {
  const entries = await getBlacklist();
  const key = type === 'domain' ? extractDomain(url) : url;

  const exists = entries.some((e) => e.type === type && e.url === key);

  if (!exists) {
    entries.push({
      url: key,
      type,
      addedAt: Date.now(),
    });
    await saveBlacklist(entries);
  }
}

/**
 * Add URL to allowlist (enable for non-job-portal site)
 */
export async function addToAllowlist(url: string, type: 'page' | 'domain' = 'domain'): Promise<void> {
  const entries = await getAllowlist();
  const key = type === 'domain' ? extractDomain(url) : url;

  const exists = entries.some((e) => e.type === type && e.url === key);

  if (!exists) {
    entries.push({
      url: key,
      type,
      addedAt: Date.now(),
    });
    await saveAllowlist(entries);
  }
}

/**
 * Remove URL from blacklist (re-enable for job portal)
 */
export async function removeFromBlacklist(url: string): Promise<void> {
  const entries = await getBlacklist();
  const domain = extractDomain(url);

  const filtered = entries.filter((e) => !(e.url === url || e.url === domain));
  await saveBlacklist(filtered);
}

/**
 * Remove URL from allowlist (disable for non-job-portal)
 */
export async function removeFromAllowlist(url: string): Promise<void> {
  const entries = await getAllowlist();
  const domain = extractDomain(url);

  const filtered = entries.filter((e) => !(e.url === url || e.url === domain));
  await saveAllowlist(filtered);
}

/**
 * Check if URL is blacklisted (disabled by user on job portal)
 */
export async function isBlacklisted(url: string): Promise<boolean> {
  const entries = await getBlacklist();
  const domain = extractDomain(url);

  return entries.some((e) => e.url === url || (e.type === 'domain' && e.url === domain));
}

/**
 * Check if URL is allowlisted (enabled by user on non-job-portal)
 */
export async function isAllowlisted(url: string): Promise<boolean> {
  const entries = await getAllowlist();
  const domain = extractDomain(url);

  return entries.some((e) => e.url === url || (e.type === 'domain' && e.url === domain));
}

/**
 * Get all blacklist entries (for settings UI)
 */
export async function getBlacklistEntries(): Promise<BlacklistEntry[]> {
  return getBlacklist();
}

/**
 * Get all allowlist entries
 */
export async function getAllowlistEntries(): Promise<BlacklistEntry[]> {
  return getAllowlist();
}
