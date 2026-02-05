import type { PrewritePageData } from '@/types/schema';
import { scanPage } from '@/lib/scanner';

export default defineContentScript({
  matches: [
    '*://*/*',
    // Common job board iframe sources
    'https://*.greenhouse.io/*',
    'https://*.lever.co/*',
    'https://*.workday.com/*',
    'https://*.icims.com/*',
    'https://*.smartrecruiters.com/*',
    'https://*.ashbyhq.com/*',
  ],
  allFrames: true, // Run inside iframes too
  main() {
    console.log('[Prewrite] Content script loaded on:', window.location.href);

    // Listen for messages from popup
    browser.runtime.onMessage.addListener(
      (message: { type: string }, _sender, sendResponse: (response: PrewritePageData) => void) => {
        if (message.type === 'SCAN_PAGE') {
          console.log('[Prewrite] Scanning page...');

          // Use retry logic for SPAs that may not have hydrated yet
          scanWithRetry()
            .then((data) => {
              console.log('[Prewrite] Scan complete:', data);
              sendResponse(data);
            })
            .catch((err) => {
              console.error('[Prewrite] Scan failed:', err);
              sendResponse(scanPage()); // Return whatever we have
            });
        }
        return true; // Keep channel open for async response
      }
    );
  },
});

/**
 * Scan with retry logic for SPAs that hydrate after initial load
 */
async function scanWithRetry(maxRetries = 3, delayMs = 500): Promise<PrewritePageData> {
  let lastResult = scanPage();

  // If we found fields, return immediately
  if (lastResult.form_fields.length > 0) {
    return lastResult;
  }

  // Retry with delay for SPA hydration
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    lastResult = scanPage();

    if (lastResult.form_fields.length > 0) {
      return lastResult;
    }
  }

  // Return whatever we found (might be empty)
  return lastResult;
}
