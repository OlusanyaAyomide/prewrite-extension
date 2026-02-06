import { useState, useCallback } from 'react';
import type { PrewritePageData } from '@/types/schema';
import { scanPage } from '@/lib/scanner';

interface UseContentScannerResult {
  data: PrewritePageData | null;
  isLoading: boolean;
  error: string | null;
  scan: () => Promise<void>;
}

/**
 * Hook for scanning the current page directly from a content script context.
 * Unlike useScanner, this doesn't use browser.tabs APIs which aren't available in content scripts.
 */
export function useContentScanner(): UseContentScannerResult {
  const [data, setData] = useState<PrewritePageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Scan the page directly - we're already in the content script context
      const result = scanPage();

      if (result && (result.form_fields.length > 0 || result.proposed_job_descriptions.length > 0)) {
        setData(result);
      } else {
        throw new Error('No form fields or job info found on this page.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scan page';
      setError(message);
      console.error('[Prewrite] Content scan error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, scan };
}
