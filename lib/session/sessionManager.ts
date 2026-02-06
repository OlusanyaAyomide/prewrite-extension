import type { JobSession } from '@/types/autofill';

const SESSION_KEY = 'prewrite_job_sessions';
const MAX_SESSIONS = 5;
const SESSION_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Get all sessions from storage
 */
async function getSessions(): Promise<JobSession[]> {
  const result = await browser.storage.session.get(SESSION_KEY);
  const sessions = result[SESSION_KEY];
  return Array.isArray(sessions) ? sessions : [];
}

/**
 * Save sessions to storage
 */
async function saveSessions(sessions: JobSession[]): Promise<void> {
  await browser.storage.session.set({ [SESSION_KEY]: sessions });
}

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Extract job identifier from URL
 */
export function extractJobIdentifier(url: string): string {
  try {
    const urlObj = new URL(url);
    // Use pathname as identifier, remove trailing slashes
    return urlObj.pathname.replace(/\/$/, '') || '/';
  } catch {
    return url;
  }
}

/**
 * Clean expired sessions (> 15 min old)
 */
export async function cleanExpiredSessions(): Promise<void> {
  const sessions = await getSessions();
  const now = Date.now();
  const validSessions = sessions.filter(
    (s) => now - s.lastAccessedAt < SESSION_EXPIRY_MS
  );
  if (validSessions.length !== sessions.length) {
    await saveSessions(validSessions);
  }
}

/**
 * Add or update a job session
 * Moves to front if exists, evicts oldest if > MAX_SESSIONS
 */
export async function addSession(
  session: Omit<JobSession, 'id' | 'createdAt' | 'lastAccessedAt'>
): Promise<JobSession> {
  await cleanExpiredSessions();

  let sessions = await getSessions();
  const now = Date.now();

  // Check if session with same domain + jobIdentifier exists
  const existingIndex = sessions.findIndex(
    (s) => s.domain === session.domain && s.jobIdentifier === session.jobIdentifier
  );

  let newSession: JobSession;

  if (existingIndex >= 0) {
    // Update existing and move to front
    newSession = {
      ...sessions[existingIndex],
      ...session,
      lastAccessedAt: now,
    };
    sessions.splice(existingIndex, 1);
    sessions.unshift(newSession);
  } else {
    // Create new session
    newSession = {
      ...session,
      id: generateSessionId(),
      createdAt: now,
      lastAccessedAt: now,
    };
    sessions.unshift(newSession);

    // Evict oldest if over limit
    if (sessions.length > MAX_SESSIONS) {
      sessions = sessions.slice(0, MAX_SESSIONS);
    }
  }

  await saveSessions(sessions);
  return newSession;
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
  const filteredSessions = sessions.filter((s) => s.id !== id);

  if (filteredSessions.length !== sessions.length) {
    await saveSessions(filteredSessions);
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
