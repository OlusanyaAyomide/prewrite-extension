import { useState, useCallback } from 'react';
import type { PrewritePageData, FormField, ActionButton } from '@/types/schema';

interface UseScannerResult {
  data: PrewritePageData | null;
  isLoading: boolean;
  error: string | null;
  scan: () => Promise<void>;
}

/**
 * Hook for scanning the current page via content script
 * Aggregates results from all frames (main page + iframes)
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

      // Send message to ALL frames in the tab
      const responses = await browser.tabs.sendMessage(
        tab.id,
        { type: 'SCAN_PAGE' },
        { frameId: undefined } // undefined = send to all frames
      ).catch(() => null);

      // If single response (from main frame)
      if (responses && !Array.isArray(responses)) {
        setData(responses as PrewritePageData);
        return;
      }

      // Try to get responses from all frames using scripting API
      const allFrameResults = await scanAllFrames(tab.id);

      if (allFrameResults) {
        setData(allFrameResults);
      } else {
        throw new Error('No form fields found. This page may use a protected iframe or dynamic loading.');
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

/**
 * Scan all frames in a tab and aggregate results
 */
async function scanAllFrames(tabId: number): Promise<PrewritePageData | null> {
  try {
    // Get all frames in the tab
    const frames = await browser.webNavigation.getAllFrames({ tabId });

    if (!frames || frames.length === 0) {
      return null;
    }

    const allFields: FormField[] = [];
    const allButtons: ActionButton[] = [];
    let mainPageData: PrewritePageData | null = null;
    const seenFieldIds = new Set<string>();
    const seenButtonIds = new Set<string>();

    // Send message to each frame
    for (const frame of frames) {
      try {
        const response = await browser.tabs.sendMessage(
          tabId,
          { type: 'SCAN_PAGE' },
          { frameId: frame.frameId }
        ) as PrewritePageData | null;

        if (response) {
          // Use main frame (frameId 0) for page metadata
          if (frame.frameId === 0) {
            mainPageData = response;
          }

          // Aggregate unique fields
          response.form_fields.forEach((field) => {
            const key = `${field.field_id}-${field.field_name}-${field.field_label}`;
            if (!seenFieldIds.has(key)) {
              seenFieldIds.add(key);
              allFields.push(field);
            }
          });

          // Aggregate unique buttons
          response.action_buttons.forEach((button) => {
            if (!seenButtonIds.has(button.button_id)) {
              seenButtonIds.add(button.button_id);
              allButtons.push(button);
            }
          });
        }
      } catch (frameErr) {
        // Frame might not have content script, skip it
        console.log(`[Prewrite] Could not scan frame ${frame.frameId}:`, frameErr);
      }
    }

    // If we got any results, return aggregated data
    if (mainPageData || allFields.length > 0) {
      return {
        page_url: mainPageData?.page_url || window.location.href,
        page_title: mainPageData?.page_title || document.title,
        proposed_company_names: mainPageData?.proposed_company_names || [],
        proposed_job_titles: mainPageData?.proposed_job_titles || [],
        proposed_job_descriptions: mainPageData?.proposed_job_descriptions || [],
        form_fields: allFields,
        action_buttons: allButtons,
        form_metadata: {
          detected_multi_page: allButtons.some((b) => b.button_type === 'PREVIOUS'),
          estimated_step: mainPageData?.form_metadata?.estimated_step || 1,
        },
      };
    }

    return null;
  } catch (err) {
    console.error('[Prewrite] Failed to scan all frames:', err);
    return null;
  }
}
