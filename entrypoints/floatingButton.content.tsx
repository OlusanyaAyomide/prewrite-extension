import { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { isJobPortalUrl } from '@/lib/jobPortalDetector';
import { useContentScanner } from '@/hooks/useContentScanner';
import { useTheme } from '@/hooks/useTheme';
import {
  FieldPreviewList,
  ActionButtonList,
  MetadataCard,
  JobDescriptionCard,
  Button,
  ThemeToggle
} from '@/components/ui';
import '@/assets/styles.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    // Only show on job portal URLs
    if (!isJobPortalUrl(window.location.href)) {
      return;
    }

    console.log('[Prewrite] Job portal detected:', window.location.href);

    try {
      // Create shadow root UI
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

      // Check if our element still exists after a short delay (detect SES removal)
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

// Notify background that floating button is ready
function notifyMounted() {
  browser.runtime.sendMessage({ type: 'FLOATING_BUTTON_READY' }).catch(() => {
    // Ignore errors
  });
}

// Notify background that floating button was removed
function notifyRemoved() {
  browser.runtime.sendMessage({ type: 'FLOATING_BUTTON_REMOVED' }).catch(() => {
    // Ignore errors
  });
}

interface FloatingButtonProps {
  onMounted: () => void;
  onRemoved: () => void;
}

function FloatingButton({ onMounted, onRemoved }: FloatingButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isDark, toggle } = useTheme();
  const { data, isLoading, error, scan } = useContentScanner();
  const [hasScanned, setHasScanned] = useState(false);
  const mountedRef = useRef(false);

  // Notify on mount
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      onMounted();
      console.log('[Prewrite] Floating button mounted successfully');
    }

    // Cleanup on unmount
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

  return (
    <div className={`prewrite-floating-root ${isDark ? 'dark' : ''}`}>
      {/* Floating Button */}
      {!isExpanded && (
        <button
          className="floating-btn"
          onClick={() => setIsExpanded(true)}
          title="Open Prewrite"
        >
          <img
            src="https://res.cloudinary.com/dsjmccsbe/image/upload/v1770402279/prly/sandbox/b332235245a1a4b0b4f8266e.png"
            alt="Prewrite"
            className="floating-btn-icon"
          />
        </button>
      )}

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="floating-panel">
          {/* Panel Header */}
          <div className="floating-panel-header">
            <div className="floating-panel-brand">
              <img
                src="https://res.cloudinary.com/dsjmccsbe/image/upload/v1770402279/prly/sandbox/b332235245a1a4b0b4f8266e.png"
                alt="Prewrite"
                className="floating-panel-logo"
              />
              <span className="floating-panel-title">Prewrite</span>
            </div>
            <div className="floating-panel-actions">
              <ThemeToggle isDark={isDark} onToggle={toggle} />
              <button
                className="floating-panel-close"
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
          <div className="floating-panel-content">
            {isLoading ? (
              <div className="floating-panel-loading">
                <div className="spinner" />
                <p>Scanning page...</p>
              </div>
            ) : error ? (
              <div className="floating-panel-error">
                <p>{error}</p>
                <Button onClick={scan} variant="secondary">
                  Retry Scan
                </Button>
              </div>
            ) : data ? (
              <>
                {/* Stats */}
                <div className="floating-panel-stats">
                  <span>
                    <strong>{data.form_fields.length}</strong> fields
                  </span>
                  <span className="stats-divider">•</span>
                  <span>
                    <strong>{data.action_buttons.length}</strong> buttons
                  </span>
                </div>

                {/* Metadata */}
                <div className="floating-panel-section">
                  <MetadataCard
                    metadata={data.form_metadata}
                    companyNames={data.proposed_company_names}
                    jobTitles={data.proposed_job_titles}
                  />
                </div>

                {/* Job Descriptions */}
                {data.proposed_job_descriptions.length > 0 && (
                  <JobDescriptionCard descriptions={data.proposed_job_descriptions} />
                )}

                {/* Fields */}
                <div className="floating-panel-section">
                  <p className="floating-section-title">Form Fields</p>
                  <FieldPreviewList fields={data.form_fields} />
                </div>

                {/* Action Buttons */}
                {data.action_buttons.length > 0 && (
                  <div className="floating-panel-section">
                    <p className="floating-section-title">Actions</p>
                    <ActionButtonList buttons={data.action_buttons} />
                  </div>
                )}
              </>
            ) : (
              <div className="floating-panel-empty">
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
