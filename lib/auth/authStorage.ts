/**
 * Auth session storage utilities
 * Manages access tokens and user data in chrome.storage.local
 */

export interface AuthUser {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
}

export interface AuthSession {
  accessToken: string;
  user: AuthUser;
  tokenExpiry: string; // ISO date string
}

const STORAGE_KEY = 'prewrite_auth_session';

/**
 * Save auth session to storage
 */
export async function saveAuthSession(session: AuthSession): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: session });
}

/**
 * Get auth session from storage
 */
export async function getAuthSession(): Promise<AuthSession | null> {
  const result = await browser.storage.local.get(STORAGE_KEY);
  const session = result[STORAGE_KEY] as AuthSession | undefined;
  return session || null;
}

/**
 * Clear auth session from storage
 */
export async function clearAuthSession(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEY);
}

/**
 * Check if current session is valid (exists and not expired)
 */
export async function isSessionValid(): Promise<boolean> {
  const session = await getAuthSession();
  if (!session) return false;

  const expiry = new Date(session.tokenExpiry);
  const now = new Date();

  return expiry > now;
}

/**
 * Get user display name
 */
export function getUserDisplayName(user: AuthUser): string {
  return `${user.first_name} ${user.last_name}`;
}
