import type { PrewritePageData } from '@/types/schema';
import { scanPage } from '@/lib/scanner';

export default defineContentScript({
  matches: ['*://*/*'],
  main() {
    console.log('[Prewrite] Content script loaded');

    // Listen for messages from popup
    browser.runtime.onMessage.addListener(
      (message: { type: string }, _sender, sendResponse: (response: PrewritePageData) => void) => {
        if (message.type === 'SCAN_PAGE') {
          console.log('[Prewrite] Scanning page...');
          const data = scanPage();
          console.log('[Prewrite] Scan complete:', data);
          sendResponse(data);
        }
        return true; // Keep channel open for async response
      }
    );
  },
});
