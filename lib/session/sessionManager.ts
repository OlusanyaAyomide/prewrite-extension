import type { JobSession } from '@/types/autofill';
import type { PrewritePageData } from '@/types/schema';

const SESSION_KEY = 'prewrite_job_sessions';
const SESSION_UPDATED_KEY = 'prewrite_sessions_updated';
const SPA_DISPATCH_KEY = 'prewrite_spa_dispatch';
const SPA_DISPATCH_WINDOW_MS = 30_000; // 30 seconds
const MAX_SESSIONS = 10;
const SESSION_EXPIRY_MS = 1 * 60 * 60 * 1000; // 1 hour

// ============ STORAGE HELPERS ============

async function getSessions(): Promise<JobSession[]> {
  const result = await browser.storage.session.get(SESSION_KEY);
  const sessions = result[SESSION_KEY];
  return Array.isArray(sessions) ? sessions : [];
}

async function saveSessions(sessions: JobSession[]): Promise<void> {
  await browser.storage.session.set({ [SESSION_KEY]: sessions });
}

/**
 * Notify popup/other consumers that sessions changed.
 * Writes a timestamp so `storage.onChanged` fires.
 */
async function notifySessionChange(): Promise<void> {
  await browser.storage.session.set({ [SESSION_UPDATED_KEY]: Date.now() });
}

// ============ DETERMINISTIC ID ============

/**
 * Generate a deterministic session ID from key job metadata.
 * Same inputs always produce the same ID, so re-scanning the same
 * job page reuses the existing session.
 */
export function generateSessionId(
  domain: string,
  company: string | null,
  jobTitle: string | null,
  jobIdentifier: string
): string {
  const raw = [
    domain.toLowerCase(),
    (company || '').toLowerCase().trim(),
    (jobTitle || '').toLowerCase().trim(),
    jobIdentifier.toLowerCase(),
  ].join('|');

  // Simple hash — consistent across calls
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit int
  }
  return `sess_${Math.abs(hash).toString(36)}`;
}

// ============ URL HELPERS ============

/**
 * Extract job identifier from URL (pathname + query string + hash).
 * Includes all URL components so that different query params (e.g. ?vjk=abc vs ?vjk=xyz)
 * produce distinct session IDs.
 */
export function extractJobIdentifier(url: string): string {
  try {
    const urlObj = new URL(url);
    // Sort query params for consistency (same params in different order = same ID)
    urlObj.searchParams.sort();
    const path = urlObj.pathname.replace(/\/$/, '') || '/';
    const query = urlObj.searchParams.toString();
    const hash = urlObj.hash;
    return `${path}${query ? '?' + query : ''}${hash}`;
  } catch {
    return url;
  }
}

// ============ DOMAIN HELPERS ============

/**
 * Extract the root domain from a hostname for subdomain matching.
 * e.g. "jobs.indeed.com" -> "indeed.com"
 *      "apply.company.co.uk" -> "company.co.uk"
 */
export function getRootDomain(hostname: string): string {
  const parts = hostname.toLowerCase().split('.');
  // Handle two-part TLDs like co.uk, com.au, etc.
  const twoPartTlds = ['co.uk', 'com.au', 'co.in', 'co.jp', 'com.br', 'co.za', 'co.nz'];
  const lastTwo = parts.slice(-2).join('.');
  if (twoPartTlds.includes(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }
  // Standard: take last 2 parts
  return parts.slice(-2).join('.');
}

/**
 * Check if two domains match, including subdomain matching.
 * e.g. "indeed.com" matches "jobs.indeed.com"
 */
export function doDomainsMatch(domain1: string, domain2: string): boolean {
  console.log(getRootDomain(domain1), getRootDomain(domain2));
  return getRootDomain(domain1) === getRootDomain(domain2);
}

// ============ SPA DISPATCH TRACKING ============

interface SpaDispatchData {
  domain: string;
  sessionId: string;
  timestamp: number;
}

/**
 * Save SPA dispatch info when a navigation button is clicked.
 * Used to link sessions within a 20-second window.
 */
export async function saveSpaDispatch(domain: string, sessionId: string): Promise<void> {
  const data: SpaDispatchData = {
    domain,
    sessionId,
    timestamp: Date.now(),
  };
  await browser.storage.session.set({ [SPA_DISPATCH_KEY]: data });
}

/**
 * Get a recent SPA dispatch for the given domain.
 * Returns null if no dispatch exists or if the 20-second window has expired.
 * Uses subdomain matching (e.g. indeed.com matches jobs.indeed.com).
 */
export async function getSpaDispatch(domain: string): Promise<SpaDispatchData | null> {
  const result = await browser.storage.session.get(SPA_DISPATCH_KEY);
  const data = result[SPA_DISPATCH_KEY] as SpaDispatchData | undefined;

  if (!data) {
    console.log("No spa dispatch found")
    return null;
  }

  // Check if within the 20-second window and domains match (including subdomains)
  const elapsed = Date.now() - data.timestamp;
  console.log(elapsed)
  if (elapsed > SPA_DISPATCH_WINDOW_MS || !doDomainsMatch(data.domain, domain)) {
    console.log("Spa Dispatch not")
    // Expired or different root domain — clean up
    await browser.storage.session.remove(SPA_DISPATCH_KEY);
    return null;
  }
  console.log('spa dispatch found', data);

  return data;
}

/**
 * Clear the SPA dispatch after it's been used
 */
export async function clearSpaDispatch(): Promise<void> {
  await browser.storage.session.remove(SPA_DISPATCH_KEY);
}

// ============ URL LINK CHECKING ============

/**
 * Check if a given URL appears in any existing session's navigationLinks.
 * Returns the session ID of the matching session, or null.
 */
export async function checkUrlInPreviousLinks(currentUrl: string): Promise<string | null> {
  const sessions = await getSessions();

  // Normalize the URL for comparison
  let normalizedUrl: string;
  try {
    const urlObj = new URL(currentUrl);
    normalizedUrl = urlObj.href;
  } catch {
    return null;
  }

  for (const session of sessions) {
    if (session.navigationLinks && session.navigationLinks.length > 0) {
      if (session.navigationLinks.includes(normalizedUrl)) {
        return session.id;
      }
    }
  }

  return null;
}

// ============ SESSION CRUD ============

/**
 * Clean expired sessions (> 2 hours old)
 */
export async function cleanExpiredSessions(): Promise<void> {
  const sessions = await getSessions();
  const now = Date.now();
  const valid = sessions.filter((s) => now - s.lastAccessedAt < SESSION_EXPIRY_MS);
  if (valid.length !== sessions.length) {
    await saveSessions(valid);
    await notifySessionChange();
  }
}

/**
 * Add or update a session using deterministic ID.
 * If a session with the same ID exists, merge new data into it.
 * Returns the created/updated session.
 */
export async function addOrUpdateSession(
  session: Omit<JobSession, 'id' | 'createdAt' | 'lastAccessedAt' | 'parentSessionId' | 'pageUrls'>,
  parentSessionId?: string | null
): Promise<JobSession> {
  await cleanExpiredSessions();

  let sessions = await getSessions();
  const now = Date.now();

  // Generate deterministic ID
  const id = generateSessionId(
    session.domain,
    session.company,
    session.jobTitle,
    session.jobIdentifier
  );

  const existingIndex = sessions.findIndex((s) => s.id === id);

  let resultSession: JobSession;

  if (existingIndex >= 0) {
    // Update existing session, merge data
    const existing = sessions[existingIndex];
    resultSession = {
      ...existing,
      company: session.company || existing.company,
      jobTitle: session.jobTitle || existing.jobTitle,
      jobDescription: session.jobDescription || existing.jobDescription,
      formFields: session.formFields.length > 0 ? session.formFields : existing.formFields,
      scannedData: session.scannedData || existing.scannedData,
      navigationLinks: session.navigationLinks.length > 0
        ? session.navigationLinks
        : existing.navigationLinks,
      parentSessionId: parentSessionId ?? existing.parentSessionId,
      pageUrls: addUniqueUrl(existing.pageUrls, session.scannedData?.page_url),
      lastAccessedAt: now,
    };
    sessions.splice(existingIndex, 1);
    sessions.unshift(resultSession);
  } else {
    // Create new session
    const pageUrls: string[] = [];
    if (session.scannedData?.page_url) {
      pageUrls.push(session.scannedData.page_url);
    }

    resultSession = {
      ...session,
      id,
      parentSessionId: parentSessionId || null,
      pageUrls,
      createdAt: now,
      lastAccessedAt: now,
    };
    sessions.unshift(resultSession);

    // Evict oldest if over limit
    if (sessions.length > MAX_SESSIONS) {
      sessions = sessions.slice(0, MAX_SESSIONS);
    }
  }

  await saveSessions(sessions);
  await notifySessionChange();
  return resultSession;
}

/**
 * Legacy `addSession` — wraps `addOrUpdateSession` for backward compat
 */
export async function addSession(
  session: Omit<JobSession, 'id' | 'createdAt' | 'lastAccessedAt'>
): Promise<JobSession> {
  return addOrUpdateSession({
    domain: session.domain,
    jobIdentifier: session.jobIdentifier,
    company: session.company,
    jobTitle: session.jobTitle,
    jobDescription: session.jobDescription,
    formFields: session.formFields,
    scannedData: session.scannedData || null,
    navigationLinks: session.navigationLinks || [],
  }, session.parentSessionId);
}

/**
 * Link a child session to a parent (set parentSessionId on child,
 * add child URL to parent's pageUrls)
 */
export async function linkSession(
  childSessionId: string,
  parentSessionId: string
): Promise<void> {
  const sessions = await getSessions();

  const child = sessions.find((s) => s.id === childSessionId);
  const parent = sessions.find((s) => s.id === parentSessionId);

  if (child) {
    child.parentSessionId = parentSessionId;
  }
  if (parent && child) {
    parent.pageUrls = addUniqueUrl(parent.pageUrls, child.pageUrls[0]);
    parent.lastAccessedAt = Date.now();
  }

  await saveSessions(sessions);
  await notifySessionChange();
}

/**
 * Update the scanned page data on an existing session
 */
export async function updateSessionPageData(
  sessionId: string,
  scannedData: PrewritePageData
): Promise<void> {
  const sessions = await getSessions();
  const session = sessions.find((s) => s.id === sessionId);

  if (session) {
    session.scannedData = scannedData;

    // Merge form fields (add new ones that don't exist yet)
    if (scannedData.form_fields.length > 0) {
      const existingFieldIds = new Set(session.formFields.map(f => f.field_id));
      const newFields = scannedData.form_fields.filter(f => !existingFieldIds.has(f.field_id));
      session.formFields = [...session.formFields, ...newFields];
    }

    // Update metadata if not already set
    if (!session.company && scannedData.proposed_company_names?.[0]) {
      session.company = scannedData.proposed_company_names[0];
    }
    if (!session.jobTitle && scannedData.proposed_job_titles?.[0]) {
      session.jobTitle = scannedData.proposed_job_titles[0];
    }
    if (!session.jobDescription && scannedData.proposed_job_descriptions?.[0]) {
      session.jobDescription = scannedData.proposed_job_descriptions[0];
    }

    // Merge navigation links
    session.navigationLinks = scannedData.navigation_links || session.navigationLinks;
    session.pageUrls = addUniqueUrl(session.pageUrls, scannedData.page_url);
    session.lastAccessedAt = Date.now();
    await saveSessions(sessions);
    await notifySessionChange();
  }
}

/**
 * Get session by ID (also updates lastAccessedAt)
 */
export async function getSession(id: string): Promise<JobSession | null> {
  await cleanExpiredSessions();
  const sessions = await getSessions();
  const session = sessions.find((s) => s.id === id);

  if (session) {
    session.lastAccessedAt = Date.now();
    await saveSessions(sessions);
  }

  return session || null;
}

/**
 * Get most recent session for a domain
 */
export async function getSessionByDomain(domain: string): Promise<JobSession | null> {
  await cleanExpiredSessions();
  const sessions = await getSessions();
  return sessions.find((s) => s.domain === domain) || null;
}

/**
 * Get all sessions (for popup display)
 */
export async function getAllSessions(): Promise<JobSession[]> {
  await cleanExpiredSessions();
  return getSessions();
}

/**
 * Delete session by ID
 */
export async function deleteSession(id: string): Promise<boolean> {
  const sessions = await getSessions();
  const filtered = sessions.filter((s) => s.id !== id);

  if (filtered.length !== sessions.length) {
    await saveSessions(filtered);
    await notifySessionChange();
    return true;
  }
  return false;
}

/**
 * Get current/most recent session
 */
export async function getCurrentSession(): Promise<JobSession | null> {
  await cleanExpiredSessions();
  const sessions = await getSessions();
  return sessions[0] || null;
}

// ============ HELPERS ============

function addUniqueUrl(urls: string[], newUrl?: string | null): string[] {
  if (!newUrl) return urls;
  if (urls.includes(newUrl)) return urls;
  return [...urls, newUrl];
}
