import { saveAuthSession, type AuthSession } from '@/lib/auth/authStorage';

export default defineBackground(() => {
  console.log('[Prewrite] Background script loaded', { id: browser.runtime.id });

  // Handle extension icon click - open popup
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      console.log('[Prewrite] Extension clicked on tab:', tab.id);
    }
  });

  // Handle external messages from web app (localhost:3001)
  // This receives auth tokens after login
  browser.runtime.onMessageExternal.addListener(
    async (message: { type: string; token?: string; user?: AuthSession['user']; tokenExpiry?: string }, sender, sendResponse) => {
      console.log('[Prewrite] External message received:', message.type, 'from:', sender.origin);

      if (message.type === 'AUTH_TOKEN_TRANSFER') {
        if (message.token && message.user && message.tokenExpiry) {
          try {
            const session: AuthSession = {
              accessToken: message.token,
              user: message.user,
              tokenExpiry: message.tokenExpiry,
            };
            await saveAuthSession(session);
            console.log('[Prewrite] Auth session saved successfully');
            sendResponse({ status: 'success', message: 'Token saved' });
          } catch (error) {
            console.error('[Prewrite] Failed to save auth session:', error);
            sendResponse({ status: 'error', message: 'Failed to save token' });
          }
        } else {
          sendResponse({ status: 'error', message: 'Invalid token data' });
        }
      }

      return true; // Keep message channel open for async response
    }
  );

  // Handle internal messages (from popup/content scripts)
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_AUTH_SESSION') {
      import('@/lib/auth/authStorage').then(({ getAuthSession }) => {
        getAuthSession().then((session) => {
          sendResponse({ session });
        });
      });
      return true;
    }

    if (message.type === 'LOGOUT') {
      import('@/lib/auth/authStorage').then(({ clearAuthSession }) => {
        clearAuthSession().then(() => {
          sendResponse({ status: 'success' });
        });
      });
      return true;
    }
  });
});
