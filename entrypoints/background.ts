import { saveAuthSession, type AuthSession } from '@/lib/auth/authStorage';

// Track tabs with active floating buttons
const tabsWithFloatingButton = new Map<number, boolean>();

export default defineBackground(() => {
  console.log('[Prewrite] Background script loaded', { id: browser.runtime.id });

  // Clean up when tabs are closed
  browser.tabs.onRemoved.addListener((tabId) => {
    tabsWithFloatingButton.delete(tabId);
  });

  // Clean up when tabs navigate away
  browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url) {
      tabsWithFloatingButton.delete(tabId);
    }
  });

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
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Auth messages
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

    // Floating button registration - content script reports it mounted successfully
    if (message.type === 'FLOATING_BUTTON_READY') {
      const tabId = sender.tab?.id;
      if (tabId) {
        tabsWithFloatingButton.set(tabId, true);
        console.log('[Prewrite] Floating button registered for tab:', tabId);
      }
      sendResponse({ status: 'ok' });
      return true;
    }

    // Floating button unregistered - content script reports it was removed/blocked
    if (message.type === 'FLOATING_BUTTON_REMOVED') {
      const tabId = sender.tab?.id;
      if (tabId) {
        tabsWithFloatingButton.delete(tabId);
        console.log('[Prewrite] Floating button removed from tab:', tabId);
      }
      sendResponse({ status: 'ok' });
      return true;
    }

    // Check if floating button is active on a specific tab
    if (message.type === 'CHECK_FLOATING_BUTTON') {
      const tabId = message.tabId;
      const hasFloatingButton = tabsWithFloatingButton.get(tabId) ?? false;
      sendResponse({ hasFloatingButton });
      return true;
    }
  });
});
