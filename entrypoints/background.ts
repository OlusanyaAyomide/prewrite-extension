import { saveAuthSession, type AuthSession } from '@/lib/auth/authStorage';
import * as sessionManager from '@/lib/session/sessionManager';
import * as blacklist from '@/lib/settings/domainBlacklist';
import * as generatedContent from '@/lib/storage/generatedContent';
import { initiateAutocomplete, pollJobResult, getCompletionResult, forceApply } from '@/lib/api/apiClient';
import type { PrewritePageData, JobSession, GeneratedItem } from '@/types/schema';

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

      return true;
    }
  );

  // Handle internal messages (from popup/content scripts)
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Keep channel open for async
  });
});

/**
 * Message handler - split out for cleaner code
 */
async function handleMessage(
  message: { type: string;[key: string]: unknown },
  sender: { tab?: { id?: number }; origin?: string },
  sendResponse: (response: unknown) => void
): Promise<void> {
  console.log('[Prewrite] Message received:', message.type);
  try {
    switch (message.type) {
      // ===== AUTH =====
      case 'GET_AUTH_SESSION': {
        const { getAuthSession } = await import('@/lib/auth/authStorage');
        const session = await getAuthSession();
        sendResponse({ session });
        break;
      }

      case 'LOGOUT': {
        const { clearAuthSession } = await import('@/lib/auth/authStorage');
        await clearAuthSession();
        sendResponse({ status: 'success' });
        break;
      }

      // ===== FLOATING BUTTON =====
      case 'FLOATING_BUTTON_READY': {
        const tabId = sender.tab?.id;
        if (tabId) {
          tabsWithFloatingButton.set(tabId, true);
          console.log('[Prewrite] Floating button registered for tab:', tabId);
        }
        sendResponse({ status: 'ok' });
        break;
      }

      case 'FLOATING_BUTTON_REMOVED': {
        const tabId = sender.tab?.id;
        if (tabId) {
          tabsWithFloatingButton.delete(tabId);
          console.log('[Prewrite] Floating button removed from tab:', tabId);
        }
        sendResponse({ status: 'ok' });
        break;
      }

      case 'CHECK_FLOATING_BUTTON': {
        const tabId = message.tabId as number;
        const hasFloatingButton = tabsWithFloatingButton.get(tabId) ?? false;
        sendResponse({ hasFloatingButton });
        break;
      }

      // ===== SESSION MANAGEMENT =====
      case 'SESSION_ADD': {
        const sessionData = message.session as Omit<JobSession, 'id' | 'createdAt' | 'lastAccessedAt'>;
        const newSession = await sessionManager.addSession(sessionData);
        sendResponse({ session: newSession });
        break;
      }

      case 'SESSION_GET': {
        const id = message.id as string;
        const session = await sessionManager.getSession(id);
        sendResponse({ session });
        break;
      }

      case 'SESSION_GET_BY_DOMAIN': {
        const domain = message.domain as string;
        const session = await sessionManager.getSessionByDomain(domain);
        sendResponse({ session });
        break;
      }

      case 'SESSION_LIST': {
        const sessions = await sessionManager.getAllSessions();
        sendResponse({ sessions });
        break;
      }

      case 'SESSION_DELETE': {
        const id = message.id as string;
        const deleted = await sessionManager.deleteSession(id);
        sendResponse({ deleted });
        break;
      }

      case 'SESSION_CURRENT': {
        const session = await sessionManager.getCurrentSession();
        sendResponse({ session });
        break;
      }

      // ===== BLACKLIST =====
      case 'BLACKLIST_ADD': {
        const url = message.url as string;
        const type = (message.blockType as 'page' | 'domain') || 'page';
        await blacklist.addToBlacklist(url, type);
        sendResponse({ status: 'ok' });
        break;
      }

      case 'BLACKLIST_REMOVE': {
        const url = message.url as string;
        await blacklist.removeFromBlacklist(url);
        sendResponse({ status: 'ok' });
        break;
      }

      case 'BLACKLIST_CHECK': {
        const url = message.url as string;
        const isBlocked = await blacklist.isBlacklisted(url);
        sendResponse({ isBlocked });
        break;
      }

      case 'BLACKLIST_LIST': {
        const entries = await blacklist.getBlacklistEntries();
        sendResponse({ entries });
        break;
      }

      // ===== ALLOWLIST (for non-job-portal sites) =====
      case 'ALLOWLIST_ADD': {
        const url = message.url as string;
        const type = (message.blockType as 'page' | 'domain') || 'domain';
        await blacklist.addToAllowlist(url, type);
        sendResponse({ status: 'ok' });
        break;
      }

      case 'ALLOWLIST_REMOVE': {
        const url = message.url as string;
        await blacklist.removeFromAllowlist(url);
        sendResponse({ status: 'ok' });
        break;
      }

      case 'ALLOWLIST_CHECK': {
        const url = message.url as string;
        const isAllowed = await blacklist.isAllowlisted(url);
        sendResponse({ isAllowed });
        break;
      }

      // ===== SITE STATUS (combined check) =====
      case 'SITE_STATUS': {
        const url = message.url as string;
        const { isJobPortalUrl } = await import('@/lib/jobPortalDetector');
        const isJobPortal = isJobPortalUrl(url);
        const isBlocked = await blacklist.isBlacklisted(url);
        const isAllowed = await blacklist.isAllowlisted(url);

        // Site is enabled if: (job portal AND not blocked) OR (not job portal AND allowed)
        const isEnabled = isJobPortal ? !isBlocked : isAllowed;
        sendResponse({ isJobPortal, isBlocked, isAllowed, isEnabled });
        break;
      }

      // ===== INJECT FLOATING BUTTON =====
      case 'INJECT_FLOATING_BUTTON': {
        const tabId = message.tabId as number;
        try {
          await browser.scripting.executeScript({
            target: { tabId },
            files: ['content-scripts/floatingButton.js']
          });
          sendResponse({ status: 'ok' });
        } catch (error) {
          console.error('[Prewrite] Failed to inject floating button:', error);
          sendResponse({ status: 'error', error: String(error) });
        }
        break;
      }

      // ===== GENERATED CONTENT =====
      case 'GENERATED_ADD': {
        const item = message.item as Omit<GeneratedItem, 'id' | 'createdAt'>;
        const newItem = await generatedContent.addGeneratedItem(item);
        sendResponse({ item: newItem });
        break;
      }

      case 'GENERATED_LIST': {
        const limit = (message.limit as number) || 10;
        const items = await generatedContent.getRecentGenerated(limit);
        sendResponse({ items });
        break;
      }

      case 'GENERATED_DELETE': {
        const id = message.id as string;
        const deleted = await generatedContent.deleteGeneratedItem(id);
        sendResponse({ deleted });
        break;
      }

      // ===== AUTOFILL =====
      case 'AUTOFILL_REQUEST': {
        const payload = message.payload as PrewritePageData;
        try {
          const response = await initiateAutocomplete(payload);

          // If async job started, set up SSE listener
          if (response.job_id) {
            // Store job info for later
            sendResponse({
              response,
              status: 'processing',
              message: 'Generating resume/cv... check back later'
            });

            // Start polling for completion
            pollJobResult(response.job_id)
              .then(async (result) => {
                // Store generated content
                if (result.generated_content.resume) {
                  await generatedContent.addGeneratedItem({
                    type: 'resume',
                    url: result.generated_content.resume.field_value,
                    jobTitle: payload.proposed_job_titles[0] || 'Unknown',
                    company: payload.proposed_company_names[0] || 'Unknown',
                  });
                }
                if (result.generated_content.cover_letter) {
                  await generatedContent.addGeneratedItem({
                    type: 'cover_letter',
                    url: result.generated_content.cover_letter.field_value,
                    jobTitle: payload.proposed_job_titles[0] || 'Unknown',
                    company: payload.proposed_company_names[0] || 'Unknown',
                  });
                }

                // Notify content script
                if (sender.tab?.id) {
                  browser.tabs.sendMessage(sender.tab.id, {
                    type: 'JOB_COMPLETED',
                    data: result
                  }).catch(e => console.error('[Prewrite] Failed to notify tab:', e));
                }
              })
              .catch((error) => {
                console.error('[Prewrite] Polling error:', error);
                if (sender.tab?.id) {
                  browser.tabs.sendMessage(sender.tab.id, {
                    type: 'JOB_FAILED',
                    error: error.message
                  }).catch(() => { });
                }
              });
          } else {
            // No async job, return immediately
            sendResponse({ response, status: 'complete' });
          }
        } catch (error) {
          console.error('[Prewrite] Autofill request failed:', error);
          sendResponse({
            error: error instanceof Error ? error.message : 'Autofill failed',
            status: 'error'
          });
        }
        break;
      }

      case 'AUTOFILL_GET_RESULT': {
        const jobId = message.jobId as string;
        try {
          const result = await getCompletionResult(jobId);
          sendResponse({ result, status: 'complete' });
        } catch (error) {
          sendResponse({
            error: error instanceof Error ? error.message : 'Failed to get result',
            status: 'error'
          });
        }
        break;
      }

      case 'AUTOFILL_FORCE_APPLY': {
        const { completionsReference, jobReference } = (message as any).payload;
        console.log('[Prewrite] Force applying for job:', jobReference);

        forceApply(completionsReference, jobReference)
          .then(async (result) => {
            console.log('[Prewrite] Force apply success:', result);

            // Store updated generated content
            if (result.generated_content.resume) {
              await generatedContent.addGeneratedItem({
                type: 'resume',
                url: result.generated_content.resume.field_value,
                jobTitle: 'Unknown',
                company: 'Unknown',
              });
            }
            if (result.generated_content.cover_letter) {
              await generatedContent.addGeneratedItem({
                type: 'cover_letter',
                url: result.generated_content.cover_letter.field_value,
                jobTitle: 'Unknown',
                company: 'Unknown',
              });
            }

            if (sender.tab?.id) {
              await browser.tabs.sendMessage(sender.tab.id, {
                type: 'JOB_COMPLETED',
                data: result
              });
            }
          })
          .catch((error) => {
            console.error('[Prewrite] Force apply failed:', error);
            if (sender.tab?.id) {
              browser.tabs.sendMessage(sender.tab.id, {
                type: 'JOB_FAILED',
                error: error instanceof Error ? error.message : 'Force apply failed'
              }).catch(() => { });
            }
          });

        sendResponse({ status: 'processing' });
        break;
      }

      default:
        console.log('[Prewrite] Unknown message type:', message.type);
        sendResponse({ error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('[Prewrite] Message handler error:', error);
    sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
}
