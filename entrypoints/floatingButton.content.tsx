import { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { isJobPortalUrl } from '@/lib/jobPortalDetector';
import { isBlacklisted, isAllowlisted } from '@/lib/settings/domainBlacklist';
import { useContentScanner } from '@/hooks/useContentScanner';
import { useTheme } from '@/hooks/useTheme';
import { extractJobIdentifier } from '@/lib/session/sessionManager';
import {
  Button,
  ThemeToggle
} from '@/components/ui';
import type { AutofillField } from '@/types/schema';
import '@/assets/floating.css';

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
  const { isDark, toggle } = useTheme();
  const { data, isLoading, error, scan } = useContentScanner();
  const [hasScanned, setHasScanned] = useState(false);
  const [autofillStatus, setAutofillStatus] = useState<AutofillStatus>('idle');
  const [autofillError, setAutofillError] = useState<string | null>(null);
  const [autofillData, setAutofillData] = useState<AutofillField[] | null>(null);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const mountedRef = useRef(false);

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

  // Check if we should show pulse (has form fields but not expanded)
  const shouldPulse = data && data.form_fields.length > 0 && !isExpanded && autofillStatus === 'idle';

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
          {shouldPulse && (
            <span className="pw-floating-btn-badge">{data.form_fields.length}</span>
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
                <Button onClick={() => setAutofillStatus('idle')} variant="secondary">
                  Done
                </Button>
              </div>
            ) : autofillStatus === 'error' ? (
              <div className="pw-floating-panel-error">
                <p>{autofillError || 'Something went wrong'}</p>
                <Button onClick={() => setAutofillStatus('idle')} variant="secondary">
                  Try Again
                </Button>
              </div>
            ) : data ? (
              <>
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

                {/* Detected Fields */}
                <div className="pw-floating-panel-section">
                  <div className="pw-section-header">
                    <span className="pw-section-title">Detected Fields</span>
                    <span className="pw-section-count">{selectedFields.size}/{data.form_fields.length}</span>
                  </div>
                  <div className="pw-field-list">
                    {data.form_fields.map((field) => (
                      <label key={field.field_id} className="pw-field-item">
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

                {/* Autofill Button */}
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
