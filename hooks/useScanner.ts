import { useState, useCallback } from 'react';
import type { PrewritePageData } from '@/types/schema';

interface UseScannerResult {
  data: PrewritePageData | null;
  isLoading: boolean;
  error: string | null;
  scan: () => Promise<void>;
}

/**
 * Hook for scanning the current page via content script
 */
export function useScanner(): UseScannerResult {
  const [data, setData] = useState<PrewritePageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get the active tab
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id) {
        throw new Error('No active tab found');
      }

      // Send message to content script
      const response = await browser.tabs.sendMessage(tab.id, { type: 'SCAN_PAGE' });

      if (response) {
        setData(response as PrewritePageData);
      } else {
        throw new Error('No response from content script. Try refreshing the page.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scan page';
      setError(message);
      console.error('[Prewrite] Scan error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, scan };
}
