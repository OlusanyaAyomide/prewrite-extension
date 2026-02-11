import { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { isJobPortalUrl } from '@/lib/jobPortalDetector';
import { isBlacklisted, isAllowlisted } from '@/lib/settings/domainBlacklist';
import { useContentScanner } from '@/hooks/useContentScanner';
import { useTheme } from '@/hooks/useTheme';
import { extractJobIdentifier, generateSessionId } from '@/lib/session/sessionManager';
import { detectSpaElements } from '@/lib/scanner/buttonDetector';
import type { AutofillField, CompletionResult } from '@/types/schema';
import type { JobSession } from '@/types/autofill';
import {
  Button,
  ThemeToggle
} from '@/components/ui';
import '@/assets/floating.css';

// ===== HISTORY INTERCEPT (pushState/replaceState) =====
// Monkey-patch history methods to fire a custom event on SPA navigations
// Guarded for browser context only (WXT analyzes modules in Node)
if (typeof window !== 'undefined' && typeof history !== 'undefined') {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    const result = originalPushState.apply(this, args);
    window.dispatchEvent(new Event('prewrite:urlchange'));
    return result;
  };

  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    const result = originalReplaceState.apply(this, args);
    window.dispatchEvent(new Event('prewrite:urlchange'));
    return result;
  };
}

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    const currentUrl = window.location.href;
    const isJobPortal = isJobPortalUrl(currentUrl);

    // Determine if we should show the floating button
    let shouldShow = false;

    if (isJobPortal) {
      // Job portal: show unless blacklisted
      shouldShow = !(await isBlacklisted(currentUrl));
      if (!shouldShow) {
        console.log('[Prewrite] Job portal blacklisted, skipping:', currentUrl);
        return;
      }
    } else {
      // Non-job portal: only show if user manually enabled (allowlisted)
      shouldShow = await isAllowlisted(currentUrl);
      if (!shouldShow) {
        // Not a job portal and not allowlisted - don't show
        return;
      }
      console.log('[Prewrite] Site allowlisted, showing button:', currentUrl);
    }

    console.log('[Prewrite] Showing floating button:', currentUrl);

    try {
      const ui = await createShadowRootUi(ctx, {
        name: 'prewrite-floating-button',
        position: 'inline',
        anchor: 'body',
        append: 'last',
        onMount(container) {
          const root = ReactDOM.createRoot(container);
          root.render(<FloatingButton onMounted={notifyMounted} onRemoved={notifyRemoved} />);
          return root;
        },
        onRemove(root) {
          root?.unmount();
          notifyRemoved();
        },
      });

      ui.mount();

      // Listen for hide message from popup/background
      const messageListener = (message: { type: string }) => {
        if (message.type === 'HIDE_FLOATING_BUTTON') {
          console.log('[Prewrite] Hiding floating button');
          ui.remove();
          browser.runtime.onMessage.removeListener(messageListener);
        }
      };
      browser.runtime.onMessage.addListener(messageListener);

      // Check if our element still exists after a short delay
      setTimeout(() => {
        const element = document.querySelector('prewrite-floating-button');
        if (!element) {
          console.log('[Prewrite] Floating button was removed by page security');
          notifyRemoved();
        }
      }, 1000);

    } catch (error) {
      console.error('[Prewrite] Failed to create floating button:', error);
      notifyRemoved();
    }
  },
});

function notifyMounted() {
  browser.runtime.sendMessage({ type: 'FLOATING_BUTTON_READY' }).catch(() => { });
}

function notifyRemoved() {
  browser.runtime.sendMessage({ type: 'FLOATING_BUTTON_REMOVED' }).catch(() => { });
}

type AutofillStatus = 'idle' | 'scanning' | 'ready' | 'autofilling' | 'generating' | 'complete' | 'error';

interface FloatingButtonProps {
  onMounted: () => void;
  onRemoved: () => void;
}

function FloatingButton({ onMounted, onRemoved }: FloatingButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [jdExpanded, setJdExpanded] = useState(false);
  const [sessionExpanded, setSessionExpanded] = useState(false);
  const { isDark, toggle } = useTheme();
  const { data, isLoading, error, scan, reset } = useContentScanner();
  const [hasScanned, setHasScanned] = useState(false);
  const [autofillStatus, setAutofillStatus] = useState<AutofillStatus>('idle');
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const [generatedFiles, setGeneratedFiles] = useState<{ resume?: string, cover_letter?: string }>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [completionsReference, setCompletionsReference] = useState<string | null>(null);
  const [autofillData, setAutofillData] = useState<AutofillField[] | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessionData, setSessionData] = useState<JobSession | null>(null);
  const mountedRef = useRef(false);
  const lastUrlRef = useRef(window.location.href);
  const spaButtonListenersRef = useRef<Array<{ el: HTMLElement; handler: () => void }>>([]);

  // Notify on mount
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      onMounted();
      console.log('[Prewrite] Floating button mounted successfully');
    }
    return () => {
      if (mountedRef.current) {
        onRemoved();
      }
    };
  }, [onMounted, onRemoved]);

  // ===== URL CHANGE DETECTION =====
  // Uses pushState/replaceState intercepts + popstate + polling fallback
  useEffect(() => {
    const handleUrlChange = () => {
      const newUrl = window.location.href;
      if (newUrl !== lastUrlRef.current) {
        console.log('[Prewrite] URL changed:', lastUrlRef.current, '->', newUrl);
        lastUrlRef.current = newUrl;

        // Reset all state for fresh session on new URL
        reset();
        setHasScanned(false);
        setJdExpanded(false);
        setAutofillStatus('idle');
        setAutofillError(null);
        setAutofillData(null);
        setGeneratedFiles({});
        setJobId(null);
        setCompletionsReference(null);
        setCurrentSessionId(null);
        setSessionData(null);
        setSessionExpanded(false);

        // Clean up old SPA button listeners
        cleanupSpaButtonListeners();

        // Always re-scan on URL change (eagerly, regardless of panel state)
        setTimeout(() => {
          scan();
          setHasScanned(true);
        }, 500); // Small delay for DOM to settle after navigation
      }
    };

    // Listen for browser back/forward
    window.addEventListener('popstate', handleUrlChange);
    // Listen for pushState/replaceState (our custom event)
    window.addEventListener('prewrite:urlchange', handleUrlChange);

    // Poll every 2 seconds as fallback for SPAs that don't use standard history APIs
    const pollInterval = setInterval(handleUrlChange, 2000);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('prewrite:urlchange', handleUrlChange);
      clearInterval(pollInterval);
    };
  }, [reset, scan]);

  // Auto-scan on first expand
  useEffect(() => {
    if (isExpanded && !hasScanned && !data) {
      scan();
      setHasScanned(true);
    }
  }, [isExpanded, hasScanned, data, scan]);

  // Select all fields by default when data loads
  useEffect(() => {
    if (data?.form_fields) {
      setSelectedFields(new Set(data.form_fields.map(f => f.field_id)));
    }
  }, [data]);

  // Determine if this is a sessionless page (single job posting with only JD, no form, no multi-page)
  const isJobListPage = data?.job_list_detection?.is_job_list_page ?? false;
  const estimatedJobCount = data?.job_list_detection?.estimated_job_count ?? 0;
  const isSessionless = data
    ? (
      data.form_fields.length === 0 &&
      !data.form_metadata.detected_multi_page &&
      !data.action_buttons.some(b => b.button_type === 'PREVIOUS') &&
      data.proposed_job_descriptions.length > 0
    )
    : false;

  // ===== AUTO-SESSION CREATION =====
  // When scan completes with data, automatically create/update a session
  // If linked to a parent (via SPA dispatch or link-based), update the parent session
  // Otherwise create a new session
  // Skip on job list pages and sessionless pages
  useEffect(() => {
    if (!data || isJobListPage || isSessionless) return;

    const createSession = async () => {
      try {
        const currentUrl = window.location.href;
        const domain = new URL(currentUrl).hostname;
        const jobIdentifier = extractJobIdentifier(currentUrl);

        // Check SPA dispatch — did the user click an application-flow button/link
        // on a previous page that saved a dispatch for this domain?
        let parentSessionId: string | null = null;

        const spaDispatchResponse = await browser.runtime.sendMessage({
          type: 'SPA_DISPATCH_GET',
          domain,
        });
        if (spaDispatchResponse?.dispatch) {
          parentSessionId = spaDispatchResponse.dispatch.sessionId;
          console.log('[Prewrite] SPA dispatch matched, parent:', parentSessionId);
          // Clear the dispatch now that it's been used
          await browser.runtime.sendMessage({ type: 'SPA_DISPATCH_CLEAR' });
        }

        if (parentSessionId) {
          // ===== LINKED SESSION: Update the parent with new page data =====
          await browser.runtime.sendMessage({
            type: 'SESSION_UPDATE_DATA',
            sessionId: parentSessionId,
            scannedData: data,
          });
          setCurrentSessionId(parentSessionId);
          console.log('[Prewrite] Merged into parent session:', parentSessionId);
        } else {
          // ===== NEW SESSION: No parent found, create fresh =====
          const response = await browser.runtime.sendMessage({
            type: 'SESSION_ADD',
            session: {
              domain,
              jobIdentifier,
              company: data.proposed_company_names[0] || null,
              jobTitle: data.proposed_job_titles[0] || null,
              jobDescription: data.proposed_job_descriptions[0] || null,
              formFields: data.form_fields,
              scannedData: data,
              navigationLinks: data.navigation_links || [],
            }
          });

          if (response?.session?.id) {
            setCurrentSessionId(response.session.id);
            console.log('[Prewrite] New session created:', response.session.id);
          }
        }
      } catch (err) {
        console.error('[Prewrite] Failed to create/update session:', err);
      }
    };

    createSession();
  }, [data, isJobListPage, isSessionless]);

  // ===== FETCH SESSION DATA =====
  // When currentSessionId is set, fetch full session data for the dropdown
  useEffect(() => {
    if (!currentSessionId) {
      setSessionData(null);
      return;
    }

    const fetchSession = async () => {
      try {
        const response = await browser.runtime.sendMessage({
          type: 'SESSION_GET',
          id: currentSessionId,
        });
        if (response?.session) {
          setSessionData(response.session);
        }
      } catch (err) {
        console.error('[Prewrite] Failed to fetch session data:', err);
      }
    };

    fetchSession();
  }, [currentSessionId]);

  // ===== SPA BUTTON EVENT ATTACHMENT =====
  // After scan, attach click listeners to SPA navigation buttons
  // (non-submit, non-link buttons with navigation-like text)
  // Skip on job list pages and sessionless pages
  useEffect(() => {
    if (!data || data.action_buttons.length === 0 || isJobListPage || isSessionless) return;

    // Clean up previous listeners
    cleanupSpaButtonListeners();

    const spaElements = detectSpaElements(document);

    for (const el of spaElements) {
      const handler = () => {
        // Save SPA dispatch: domain + current session ID + timestamp
        if (currentSessionId) {
          const domain = new URL(window.location.href).hostname;
          browser.runtime.sendMessage({
            type: 'SPA_DISPATCH_SAVE',
            domain,
            sessionId: currentSessionId,
          }).catch(err => console.error('[Prewrite] Failed to save SPA dispatch:', err));
          console.log('[Prewrite] SPA dispatch saved for session:', currentSessionId);
        }
      };

      el.addEventListener('click', handler, { capture: true });
      spaButtonListenersRef.current.push({ el, handler });
      console.log('[Prewrite] Attached SPA listener to button:', el.textContent?.trim());
    }

    return () => cleanupSpaButtonListeners();
  }, [data, currentSessionId, isJobListPage, isSessionless]);

  // Helper to clean up SPA button listeners
  const cleanupSpaButtonListeners = useCallback(() => {
    for (const { el, handler } of spaButtonListenersRef.current) {
      el.removeEventListener('click', handler, { capture: true });
    }
    spaButtonListenersRef.current = [];
  }, []);

  // Check if we should show pulse (has form fields or descriptions but not expanded)
  const hasContent = data && (data.form_fields.length > 0 || data.proposed_job_descriptions.length > 0);
  const shouldPulse = hasContent && !isExpanded && autofillStatus === 'idle';
  const badgeCount = data ? (data.form_fields.length > 0 ? data.form_fields.length : data.proposed_job_descriptions.length) : 0;

  // Toggle field selection
  const toggleField = useCallback((fieldId: string) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  }, []);

  // Store session and initiate autofill
  const handleAutofill = useCallback(async () => {
    if (!data) return;

    setAutofillStatus('autofilling');
    setAutofillError(null);

    try {
      // First, save current page data to session
      const domain = new URL(window.location.href).hostname;
      const jobIdentifier = extractJobIdentifier(window.location.href);

      await browser.runtime.sendMessage({
        type: 'SESSION_ADD',
        session: {
          domain,
          jobIdentifier,
          company: data.proposed_company_names[0] || null,
          jobTitle: data.proposed_job_titles[0] || null,
          jobDescription: data.proposed_job_descriptions[0] || null,
          formFields: data.form_fields,
          navigationLinks: data.navigation_links || [],
        }
      });

      // Then request autofill from backend
      const response = await browser.runtime.sendMessage({
        type: 'AUTOFILL_REQUEST',
        payload: data
      });

      if (response.error) {
        throw new Error(response.error);
      }

      if (response.status === 'processing') {
        // Async job started - show generating message
        setAutofillStatus('generating');
        if (response.response?.job_id) {
          setJobId(response.response.job_id);
        }
      } else if (response.status === 'complete') {
        // Immediate response - apply autofill
        setAutofillData(response.response.autofill_data);
        // Get current selected fields directly to avoid closure issues
        const currentSelectedFields = data?.form_fields?.map(f => f.field_id) || [];
        console.log('[Prewrite] Current selected fields:', currentSelectedFields);
        applyAutofill(response.response.autofill_data, new Set(currentSelectedFields));
        setAutofillStatus('complete');
      }
    } catch (err) {
      setAutofillError(err instanceof Error ? err.message : 'Autofill failed');
      setAutofillStatus('error');
    }
  }, [data]);

  // Apply autofill data to form fields
  const applyAutofill = useCallback((autofillFields: AutofillField[], selectedFieldIds: Set<string>) => {
    console.log('[Prewrite] Applying autofill to fields:', autofillFields);
    console.log('[Prewrite] Selected field IDs:', Array.from(selectedFieldIds));

    autofillFields.forEach(field => {
      // Skip if field not selected or no value
      if (!selectedFieldIds.has(field.field_id) || field.field_value === null || field.field_value === undefined) {
        console.log('[Prewrite] Skipping field:', field.field_id, '- not selected or no value');
        return;
      }

      // Try to find the element by various selectors
      const element = document.getElementById(field.field_id) ||
        document.querySelector(`[name="${field.field_id}"]`) ||
        document.querySelector(`[data-field-id="${field.field_id}"]`);

      if (!element) {
        console.log('[Prewrite] Element not found for field:', field.field_id);
        return;
      }

      console.log('[Prewrite] Found element for field:', field.field_id, element.tagName, (element as HTMLInputElement).type);

      try {
        if (element instanceof HTMLInputElement) {
          const inputType = element.type.toLowerCase();

          if (inputType === 'checkbox') {
            // For checkbox, set checked based on truthy value
            const shouldCheck = field.field_value === 'true' || field.field_value === 'Yes' || field.field_value === '1';
            element.checked = shouldCheck;
            element.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (inputType === 'radio') {
            // For radio, find the matching radio button by value or label
            const radioName = element.name;
            const radios = document.querySelectorAll<HTMLInputElement>(`input[name="${radioName}"]`);

            radios.forEach(radio => {
              // Check if this radio's value or associated label matches
              const label = document.querySelector(`label[for="${radio.id}"]`);
              const labelText = label?.textContent?.trim().toLowerCase() || '';
              const radioValue = radio.value.toLowerCase();
              const targetValue = field.field_value!.toLowerCase();

              if (radioValue === targetValue || labelText === targetValue) {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
              }
            });
          } else if (inputType === 'file') {
            console.warn('[Prewrite] Cannot programmatically set file input value. User must upload manually:', field.field_value);
          } else {
            // Text, email, tel, number, etc.
            element.value = field.field_value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
          }
        } else if (element instanceof HTMLSelectElement) {
          // For select, find matching option by value or text
          const options = Array.from(element.options);
          const targetValue = field.field_value.toLowerCase();

          const matchingOption = options.find(opt =>
            opt.value.toLowerCase() === targetValue ||
            opt.textContent?.trim().toLowerCase() === targetValue
          );

          if (matchingOption) {
            element.value = matchingOption.value;
            element.dispatchEvent(new Event('change', { bubbles: true }));
          } else {
            console.log('[Prewrite] No matching option for select:', field.field_id, field.field_value);
          }
        } else if (element instanceof HTMLTextAreaElement) {
          element.value = field.field_value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Visual highlight
        element.classList.add('prewrite-filled');
        setTimeout(() => {
          element.classList.remove('prewrite-filled');
        }, 2000);

        console.log('[Prewrite] Successfully filled field:', field.field_id);
      } catch (err) {
        console.error('[Prewrite] Error filling field:', field.field_id, err);
      }
    });
  }, []);

  // Listen for background messages (Async job completion)
  useEffect(() => {
    const messageListener = (message: any) => {
      if (message.type === 'JOB_COMPLETED') {
        console.log('[Prewrite] Async job completed:', message.data);
        const result = message.data as CompletionResult;

        if (result.completions_reference) {
          setCompletionsReference(result.completions_reference);
        }

        const newFields: AutofillField[] = [];
        const files: { resume?: string, cover_letter?: string } = {};

        if (result.generated_content?.resume) {
          files.resume = result.generated_content.resume.field_value;
          newFields.push({
            field_id: result.generated_content.resume.field_id,
            field_value: result.generated_content.resume.field_value,
            field_type: 'file'
          });
        }

        if (result.generated_content?.cover_letter) {
          files.cover_letter = result.generated_content.cover_letter.field_value;
          newFields.push({
            field_id: result.generated_content.cover_letter.field_id,
            field_value: result.generated_content.cover_letter.field_value,
            field_type: 'file'
          });
        }

        setGeneratedFiles(files);

        if (newFields.length > 0) {
          // Merge with existing autofill data if needed
          const currentSelectedFields = data?.form_fields?.map(f => f.field_id) || [];
          applyAutofill(newFields, new Set(currentSelectedFields));
        }

        if (!result.can_apply) {
          setAutofillError(result.requirement_not_met ? result.requirement_not_met.join('\n') : 'Requirements not met');
          setAutofillStatus('error');
        } else {
          setAutofillStatus('complete');
        }

      } else if (message.type === 'JOB_FAILED') {
        console.error('[Prewrite] Async job failed:', message.error);
        setAutofillError(message.error || 'Generation failed');
        setAutofillStatus('error');
      }
    };

    browser.runtime.onMessage.addListener(messageListener);
    return () => browser.runtime.onMessage.removeListener(messageListener);
  }, [data, applyAutofill]);

  return (
    <div className={`prewrite-floating-root ${isDark ? 'pw-dark' : ''}`}>
      {/* Floating Button */}
      {!isExpanded && (
        <button
          className={`pw-floating-btn ${shouldPulse ? 'pw-pulse' : ''}`}
          onClick={() => setIsExpanded(true)}
          title="Open Prewrite"
        >
          <img
            src="https://res.cloudinary.com/dsjmccsbe/image/upload/v1770402279/prly/sandbox/b332235245a1a4b0b4f8266e.png"
            alt="Prewrite"
            className="pw-floating-btn-icon"
          />
          {shouldPulse && badgeCount > 0 && (
            <span className="pw-floating-btn-badge">{badgeCount}</span>
          )}
        </button>
      )}

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="pw-floating-panel">
          {/* Panel Header */}
          <div className="pw-floating-panel-header">
            <div className="pw-floating-panel-brand">
              <img
                src="https://res.cloudinary.com/dsjmccsbe/image/upload/v1770402279/prly/sandbox/b332235245a1a4b0b4f8266e.png"
                alt="Prewrite"
                className="pw-floating-panel-logo"
              />
              <span className="pw-floating-panel-title">Prewrite</span>
            </div>
            <div className="pw-floating-panel-actions">
              <ThemeToggle isDark={isDark} onToggle={toggle} />
              <button
                className="pw-floating-panel-close"
                onClick={() => setIsExpanded(false)}
                title="Close"
              >
                <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          {/* Panel Content */}
          <div className="pw-floating-panel-content">
            {isLoading ? (
              <div className="pw-floating-panel-loading">
                <div className="pw-spinner" />
                <p>Scanning page...</p>
              </div>
            ) : error ? (
              <div className="pw-floating-panel-error">
                <p>{error}</p>
                <Button onClick={scan} variant="secondary">
                  Retry Scan
                </Button>
              </div>
            ) : autofillStatus === 'generating' ? (
              <div className="pw-floating-panel-generating">
                <div className="pw-spinner" />
                <p className="pw-generating-title">Generating resume/cv...</p>
                <p className="pw-generating-subtitle">Check back later for download</p>
              </div>
            ) : autofillStatus === 'complete' ? (
              <div className="pw-floating-panel-success">
                <div className="pw-success-icon">✓</div>
                <p>Fields filled successfully!</p>
                {generatedFiles.resume && (
                  <a
                    href={generatedFiles.resume}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pw-btn pw-btn-secondary"
                    style={{ marginTop: 8, display: 'block', textDecoration: 'none', width: '100%', textAlign: 'center' }}
                  >
                    Download Resume
                  </a>
                )}
                {generatedFiles.cover_letter && (
                  <a
                    href={generatedFiles.cover_letter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pw-btn pw-btn-secondary"
                    style={{ marginTop: 8, display: 'block', textDecoration: 'none', width: '100%', textAlign: 'center' }}
                  >
                    Download Cover Letter
                  </a>
                )}
                <Button onClick={() => setAutofillStatus('idle')} variant="secondary" style={{ marginTop: 8, width: '100%' }}>
                  Done
                </Button>
              </div>
            ) : autofillStatus === 'error' ? (
              <div className="pw-floating-panel-error">
                <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px', color: 'var(--pw-text-primary)' }}>
                  {(generatedFiles.resume || generatedFiles.cover_letter) ? 'Generated with Warnings' : 'Unable to Generate Resume/CV'}
                </h3>
                <div style={{ textAlign: 'left', width: '100%', marginBottom: 16 }}>
                  {autofillError ? autofillError.split('\n').map((err, i) => (
                    <div key={i} style={{
                      fontSize: '13px',
                      color: 'var(--pw-text-primary)',
                      lineHeight: '1.5',
                      marginBottom: '8px',
                      display: 'flex',
                      gap: '6px'
                    }}>
                      <span style={{ color: 'var(--pw-error)', flexShrink: 0 }}>•</span>
                      <span>{err}</span>
                    </div>
                  )) : (
                    <p style={{ color: 'var(--pw-text-secondary)' }}>Something went wrong</p>
                  )}
                </div>
                {generatedFiles.resume && (
                  <a
                    href={generatedFiles.resume}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="pw-btn pw-btn-secondary"
                    style={{ marginTop: 8, display: 'block', textDecoration: 'none', width: '100%', textAlign: 'center' }}
                  >
                    Download Resume
                  </a>
                )}
                {generatedFiles.cover_letter && (
                  <a
                    href={generatedFiles.cover_letter}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="pw-btn pw-btn-secondary"
                    style={{ marginTop: 8, display: 'block', textDecoration: 'none', width: '100%', textAlign: 'center' }}
                  >
                    Download Cover Letter
                  </a>
                )}
                <Button
                  onClick={() => {
                    if (jobId && completionsReference) {
                      setAutofillStatus('generating');
                      setAutofillError(null);
                      browser.runtime.sendMessage({
                        type: 'AUTOFILL_FORCE_APPLY',
                        payload: { jobReference: jobId, completionsReference }
                      });
                    }
                  }}
                  variant="secondary"
                  style={{ marginTop: 8, width: '100%' }}
                  disabled={!jobId || !completionsReference}
                >
                  Force Apply
                </Button>
                <Button onClick={() => setAutofillStatus('idle')} variant="secondary" style={{ marginTop: 8, width: '100%' }}>
                  Try Again
                </Button>
              </div>
            ) : data ? (
              <>
                {/* Job List Page Banner */}
                {isJobListPage && (
                  <div className="pw-job-list-banner">
                    <div className="pw-job-list-banner-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="pw-job-list-banner-text">
                      <span className="pw-job-list-banner-title">Job Listings Page</span>
                      <span className="pw-job-list-banner-desc">
                        This appears to be a listings page{estimatedJobCount > 0 ? ` (~${estimatedJobCount} jobs)` : ''}. Navigate to a specific job posting for best results.
                      </span>
                    </div>
                  </div>
                )}

                {/* Metadata Card */}
                {(data.proposed_company_names.length > 0 || data.proposed_job_titles.length > 0) && (
                  <div className="pw-floating-panel-section">
                    <div className="pw-metadata-compact">
                      {data.proposed_company_names[0] && (
                        <span className="pw-metadata-company">{data.proposed_company_names[0]}</span>
                      )}
                      {data.proposed_job_titles[0] && (
                        <span className="pw-metadata-title">{data.proposed_job_titles[0]}</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Job Description Section (Collapsible) */}
                {data.proposed_job_descriptions.length > 0 && (
                  <div className="pw-floating-panel-section">
                    <button
                      className="pw-jd-toggle"
                      onClick={() => setJdExpanded(!jdExpanded)}
                    >
                      <span className="pw-section-title">Job Description</span>
                      <div className="pw-jd-toggle-right">
                        <span className="pw-section-count">{data.proposed_job_descriptions.length} section{data.proposed_job_descriptions.length !== 1 ? 's' : ''}</span>
                        <svg
                          className={`pw-jd-chevron ${jdExpanded ? 'pw-jd-chevron-open' : ''}`}
                          width="14"
                          height="14"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>
                    {jdExpanded && (
                      <div className="pw-jd-content">
                        {data.proposed_job_descriptions.map((desc, i) => (
                          <div key={i} className="pw-jd-item">
                            {desc.split('\n').map((line, j) => {
                              if (line.startsWith('**') && line.endsWith('**')) {
                                return <strong key={j} className="pw-jd-heading">{line.replace(/\*\*/g, '')}</strong>;
                              }
                              if (line.startsWith('• ')) {
                                return <div key={j} className="pw-jd-bullet">{line}</div>;
                              }
                              return line ? <p key={j} className="pw-jd-text">{line}</p> : null;
                            })}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Session Data (Collapsible) */}
                {sessionData && (
                  <div className="pw-floating-panel-section">
                    <button
                      className="pw-jd-toggle"
                      onClick={() => setSessionExpanded(!sessionExpanded)}
                    >
                      <span className="pw-section-title">Session Data</span>
                      <div className="pw-jd-toggle-right">
                        <span className="pw-section-count">{sessionData.id.slice(0, 12)}</span>
                        <svg
                          className={`pw-jd-chevron ${sessionExpanded ? 'pw-jd-chevron-open' : ''}`}
                          width="14"
                          height="14"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>
                    {sessionExpanded && (
                      <div className="pw-session-data">
                        <div className="pw-session-row">
                          <span className="pw-session-label">Session ID</span>
                          <span className="pw-session-value pw-session-mono">{sessionData.id}</span>
                        </div>
                        <div className="pw-session-row">
                          <span className="pw-session-label">Domain</span>
                          <span className="pw-session-value">{sessionData.domain}</span>
                        </div>
                        {sessionData.company && (
                          <div className="pw-session-row">
                            <span className="pw-session-label">Company</span>
                            <span className="pw-session-value">{sessionData.company}</span>
                          </div>
                        )}
                        {sessionData.jobTitle && (
                          <div className="pw-session-row">
                            <span className="pw-session-label">Job Title</span>
                            <span className="pw-session-value">{sessionData.jobTitle}</span>
                          </div>
                        )}
                        {sessionData.parentSessionId && (
                          <div className="pw-session-row">
                            <span className="pw-session-label">Parent Session</span>
                            <span className="pw-session-value pw-session-mono">{sessionData.parentSessionId}</span>
                          </div>
                        )}
                        <div className="pw-session-row">
                          <span className="pw-session-label">Pages Visited</span>
                          <span className="pw-session-value">{sessionData.pageUrls.length}</span>
                        </div>
                        {sessionData.pageUrls.length > 0 && (
                          <div className="pw-session-urls">
                            {sessionData.pageUrls.map((url, i) => (
                              <div key={i} className="pw-session-url">
                                {(() => { try { return new URL(url).pathname; } catch { return url; } })()}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="pw-session-row">
                          <span className="pw-session-label">Form Fields</span>
                          <span className="pw-session-value">{sessionData.formFields.length}</span>
                        </div>
                        <div className="pw-session-row">
                          <span className="pw-session-label">Nav Links</span>
                          <span className="pw-session-value">{sessionData.navigationLinks.length}</span>
                        </div>
                        <div className="pw-session-row">
                          <span className="pw-session-label">Created</span>
                          <span className="pw-session-value">{new Date(sessionData.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <div className="pw-session-row">
                          <span className="pw-session-label">Last Active</span>
                          <span className="pw-session-value">{new Date(sessionData.lastAccessedAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Detected Fields */}
                {data.form_fields.length > 0 && (
                  <div className="pw-floating-panel-section">
                    <div className="pw-section-header">
                      <span className="pw-section-title">Detected Fields</span>
                      <span className="pw-section-count">{selectedFields.size}/{data.form_fields.length}</span>
                    </div>
                    <div className="pw-field-list">
                      {data.form_fields.map((field, i) => (
                        <label key={`${field.field_id}-${i}`} className="pw-field-item">
                          <input
                            type="checkbox"
                            checked={selectedFields.has(field.field_id)}
                            onChange={() => toggleField(field.field_id)}
                          />
                          <span className="pw-field-label">{field.field_label || field.field_name || field.field_id}</span>
                          <span className="pw-field-type">{field.field_type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Autofill Button (only when form fields exist) */}
                {data.form_fields.length > 0 && (
                  <div className="pw-floating-panel-footer">
                    <Button
                      onClick={handleAutofill}
                      disabled={autofillStatus === 'autofilling' || selectedFields.size === 0}
                      className="pw-autofill-btn"
                    >
                      {autofillStatus === 'autofilling' ? (
                        <>
                          <div className="pw-spinner-small" />
                          Filling...
                        </>
                      ) : (
                        <>AutoFill with Prewrite</>
                      )}
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="pw-floating-panel-empty">
                <p>Click to scan page for form fields</p>
                <Button onClick={scan}>
                  Scan Page
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
