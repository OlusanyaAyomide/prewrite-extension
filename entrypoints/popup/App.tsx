import { useState, useEffect, useCallback } from 'react';
import { useTheme, useAuth, useScanner } from '@/hooks';
import {
  Button,
  ThemeToggle,
  FieldPreviewList,
  ActionButtonList,
  MetadataCard,
  JobDescriptionCard
} from '@/components/ui';
import '@/assets/styles.css';

function App() {
  const { isDark, toggle } = useTheme();
  const { user, isAuthenticated, isLoading: authLoading, login, logout } = useAuth();
  const [hasFloatingButton, setHasFloatingButton] = useState<boolean | null>(null);
  const [isJobPortal, setIsJobPortal] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');

  // Check if current tab has floating button
  useEffect(() => {
    const checkFloatingButton = async () => {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && tab.url) {
          setCurrentUrl(tab.url);

          // Check if it's a job portal URL
          const { isJobPortalUrl } = await import('@/lib/jobPortalDetector');
          const isPortal = isJobPortalUrl(tab.url);
          setIsJobPortal(isPortal);

          if (isPortal) {
            // Check if floating button is active
            const response = await browser.runtime.sendMessage({
              type: 'CHECK_FLOATING_BUTTON',
              tabId: tab.id
            });
            setHasFloatingButton(response?.hasFloatingButton ?? false);
          } else {
            setHasFloatingButton(false);
          }
        }
      } catch (error) {
        console.error('[Prewrite] Failed to check floating button:', error);
        setHasFloatingButton(false);
      }
    };

    checkFloatingButton();
  }, []);

  return (
    <div className={`popup-container ${isDark ? 'dark' : ''}`}>
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <div className="header-logo">
            <svg className="icon-lg" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'white' }}>
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
            </svg>
          </div>
          <div>
            <h1 className="header-title">Prewrite</h1>
            <p className="header-subtitle">Job Application Assistant</p>
          </div>
        </div>
        <ThemeToggle isDark={isDark} onToggle={toggle} />
      </header>

      {/* Main Content */}
      <main className="main-content">
        {authLoading ? (
          <div className="auth-loading">
            <div className="spinner" />
            <p>Loading...</p>
          </div>
        ) : isAuthenticated && user ? (
          <AuthenticatedView
            user={user}
            logout={logout}
            hasFloatingButton={hasFloatingButton}
            isJobPortal={isJobPortal}
            currentUrl={currentUrl}
          />
        ) : (
          <LoginView login={login} />
        )}
      </main>
    </div>
  );
}

interface AuthenticatedViewProps {
  user: { first_name: string; last_name: string; email: string };
  logout: () => Promise<void>;
  hasFloatingButton: boolean | null;
  isJobPortal: boolean;
  currentUrl: string;
}

function AuthenticatedView({ user, logout, hasFloatingButton, isJobPortal }: AuthenticatedViewProps) {
  const { data, isLoading, error, scan } = useScanner();
  const [showScanner, setShowScanner] = useState(false);

  // Auto-show scanner if on job portal without floating button
  useEffect(() => {
    if (isJobPortal && hasFloatingButton === false) {
      setShowScanner(true);
    }
  }, [isJobPortal, hasFloatingButton]);

  // Auto-scan when scanner is shown
  useEffect(() => {
    if (showScanner && !data && !isLoading) {
      scan();
    }
  }, [showScanner, data, isLoading, scan]);

  return (
    <div className="auth-container">
      {/* User Info */}
      <div className="user-card">
        <div className="user-avatar">
          {user.first_name.charAt(0)}{user.last_name.charAt(0)}
        </div>
        <div className="user-info">
          <p className="user-name">{user.first_name} {user.last_name}</p>
          <p className="user-email">{user.email}</p>
        </div>
      </div>

      {/* Job Portal Status */}
      {isJobPortal && (
        <div className="status-section">
          {hasFloatingButton === null ? (
            <div className="status-card checking">
              <div className="spinner-sm" />
              <span>Checking page status...</span>
            </div>
          ) : hasFloatingButton ? (
            <div className="status-card active">
              <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Floating button active on this page</span>
            </div>
          ) : (
            <div className="status-card fallback">
              <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Using popup scanner (page blocks injection)</span>
            </div>
          )}
        </div>
      )}

      {/* Scanner UI - shown when floating button is blocked */}
      {showScanner && (
        <div className="popup-scanner">
          {isLoading ? (
            <div className="scanner-loading">
              <div className="spinner" />
              <p>Scanning page...</p>
            </div>
          ) : error ? (
            <div className="scanner-error">
              <p>{error}</p>
              <Button onClick={scan} variant="secondary">
                Retry Scan
              </Button>
            </div>
          ) : data ? (
            <div className="scanner-results">
              {/* Stats */}
              <div className="scanner-stats">
                <span><strong>{data.form_fields.length}</strong> fields</span>
                <span className="stats-divider">•</span>
                <span><strong>{data.action_buttons.length}</strong> buttons</span>
              </div>

              {/* Metadata */}
              <MetadataCard
                metadata={data.form_metadata}
                companyNames={data.proposed_company_names}
                jobTitles={data.proposed_job_titles}
              />

              {/* Job Descriptions */}
              {data.proposed_job_descriptions.length > 0 && (
                <JobDescriptionCard descriptions={data.proposed_job_descriptions} />
              )}

              {/* Fields */}
              <div className="scanner-section">
                <p className="scanner-section-title">Form Fields</p>
                <FieldPreviewList fields={data.form_fields} />
              </div>

              {/* Action Buttons */}
              {data.action_buttons.length > 0 && (
                <div className="scanner-section">
                  <p className="scanner-section-title">Actions</p>
                  <ActionButtonList buttons={data.action_buttons} />
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Manual Scan Button - when on job portal but scanner not showing */}
      {isJobPortal && !showScanner && hasFloatingButton === false && (
        <div className="scan-action">
          <Button onClick={() => setShowScanner(true)}>
            <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
            </svg>
            Scan This Page
          </Button>
        </div>
      )}

      {/* Info - only show when floating button is active */}
      {(!isJobPortal || hasFloatingButton) && (
        <div className="info-card">
          <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p>{isJobPortal ? 'Use the floating Prewrite button on this page!' : 'Navigate to a job application page to use Prewrite'}</p>
        </div>
      )}

      {/* Logout */}
      <div className="auth-actions">
        <Button variant="secondary" onClick={logout}>
          <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 001 1h12a1 1 0 001-1V4a1 1 0 00-1-1H3zm11 3a1 1 0 10-2 0v4.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L14 10.586V6z" clipRule="evenodd" transform="rotate(-90 10 10)" />
          </svg>
          Sign Out
        </Button>
      </div>
    </div>
  );
}

interface LoginViewProps {
  login: () => void;
}

function LoginView({ login }: LoginViewProps) {
  return (
    <div className="auth-container login-view">
      <div className="login-hero">
        <div className="login-icon">
          <svg className="icon-xl" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="login-title">Welcome to Prewrite</h2>
        <p className="login-subtitle">Sign in to enable autofill on job applications</p>
      </div>

      <div className="auth-actions">
        <Button onClick={login}>
          <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Sign In
        </Button>
      </div>
    </div>
  );
}

export default App;
