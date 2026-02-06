import { useState, useEffect, useCallback } from 'react';
import type { AuthSession, AuthUser } from '@/lib/auth/authStorage';

const LOGIN_URL = 'http://localhost:3001/sign-in';

interface UseAuthResult {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

/**
 * Hook for managing authentication state
 */
export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const response = await browser.runtime.sendMessage({ type: 'GET_AUTH_SESSION' });
      console.log('[Prewrite] Got auth session:', response);

      if (response?.session) {
        // Handle tokenExpiry - can be ISO string, seconds number, or ms number
        let expiry: Date;
        const tokenExpiry = response.session.tokenExpiry;

        if (typeof tokenExpiry === 'string') {
          // ISO date string
          expiry = new Date(tokenExpiry);
        } else if (typeof tokenExpiry === 'number') {
          // If less than a year in ms, it's likely seconds from now
          if (tokenExpiry < 31536000000) {
            // Seconds - add to current time
            expiry = new Date(Date.now() + tokenExpiry * 1000);
          } else {
            // Milliseconds timestamp
            expiry = new Date(tokenExpiry);
          }
        } else {
          // Default: assume valid session
          expiry = new Date(Date.now() + 86400000); // 1 day from now
        }

        console.log('[Prewrite] Token expiry:', expiry, 'Now:', new Date());

        if (expiry > new Date()) {
          setSession(response.session);
        } else {
          // Session expired, clear it
          console.log('[Prewrite] Session expired, clearing');
          await browser.runtime.sendMessage({ type: 'LOGOUT' });
          setSession(null);
        }
      } else {
        setSession(null);
      }
    } catch (error) {
      console.error('[Prewrite] Failed to get auth session:', error);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(() => {
    // Open login page in new tab
    browser.tabs.create({ url: LOGIN_URL });
  }, []);

  const logout = useCallback(async () => {
    try {
      await browser.runtime.sendMessage({ type: 'LOGOUT' });
      setSession(null);
    } catch (error) {
      console.error('[Prewrite] Logout failed:', error);
    }
  }, []);

  return {
    user: session?.user || null,
    isAuthenticated: !!session,
    isLoading,
    login,
    logout,
    refreshSession,
  };
}
