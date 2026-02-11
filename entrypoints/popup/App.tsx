import { useState, useEffect } from 'react';
import { useTheme, useAuth, useScanner } from '@/hooks';
import { Button, ThemeToggle } from '@/components/ui';
import type { JobSession, GeneratedItem } from '@/types/schema';
import '@/assets/styles.css';

type TabId = 'home' | 'sessions' | 'generated' | 'settings';

function App() {
  const { isDark, toggle } = useTheme();
  const { user, isAuthenticated, isLoading: authLoading, login, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('home');

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
          <>
            {/* Tab Navigation */}
            <nav className="tab-nav">
              <button
                className={`tab-btn ${activeTab === 'home' ? 'active' : ''}`}
                onClick={() => setActiveTab('home')}
              >
                <svg className="tab-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                <span>Home</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
                onClick={() => setActiveTab('sessions')}
              >
                <svg className="tab-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm2 10a1 1 0 10-2 0v3a1 1 0 102 0v-3zm2-3a1 1 0 011 1v5a1 1 0 11-2 0v-5a1 1 0 011-1zm4-1a1 1 0 10-2 0v7a1 1 0 102 0V8z" clipRule="evenodd" />
                </svg>
                <span>Sessions</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'generated' ? 'active' : ''}`}
                onClick={() => setActiveTab('generated')}
              >
                <svg className="tab-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                <span>Generated</span>
              </button>
              <button
                className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                <svg className="tab-icon" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                <span>Settings</span>
              </button>
            </nav>

            {/* Tab Content */}
            <div className="tab-content">
              {activeTab === 'home' && <HomeTab user={user} logout={logout} />}
              {activeTab === 'sessions' && <SessionsTab />}
              {activeTab === 'generated' && <GeneratedTab />}
              {activeTab === 'settings' && <SettingsTab />}
            </div>
          </>
        ) : (
          <LoginView login={login} />
        )}
      </main>
    </div>
  );
}

// ============ HOME TAB ============
interface HomeTabProps {
  user: { first_name: string; last_name: string; email: string };
  logout: () => Promise<void>;
}

function HomeTab({ user, logout }: HomeTabProps) {
  const [hasFloatingButton, setHasFloatingButton] = useState<boolean | null>(null);
  const [isJobPortal, setIsJobPortal] = useState(false);
  const { data, isLoading, error, scan } = useScanner();
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    const checkPage = async () => {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab?.id && tab.url) {
          const { isJobPortalUrl } = await import('@/lib/jobPortalDetector');
          const isPortal = isJobPortalUrl(tab.url);
          setIsJobPortal(isPortal);

          if (isPortal) {
            const response = await browser.runtime.sendMessage({
              type: 'CHECK_FLOATING_BUTTON',
              tabId: tab.id
            });
            setHasFloatingButton(response?.hasFloatingButton ?? false);
          } else {
            setHasFloatingButton(false);
          }
        }
      } catch {
        setHasFloatingButton(false);
      }
    };
    checkPage();
  }, []);

  // Auto-show scanner when floating button blocked
  useEffect(() => {
    if (isJobPortal && hasFloatingButton === false) {
      setShowScanner(true);
      if (!data && !isLoading) scan();
    }
  }, [isJobPortal, hasFloatingButton, data, isLoading, scan]);

  return (
    <div className="home-tab">
      {/* User Card */}
      <div className="user-card">
        <div className="user-avatar">
          {user.first_name.charAt(0)}{user.last_name.charAt(0)}
        </div>
        <div className="user-info">
          <p className="user-name">{user.first_name} {user.last_name}</p>
          <p className="user-email">{user.email}</p>
        </div>
      </div>

      {/* Status */}
      {isJobPortal && (
        <div className="status-section">
          {hasFloatingButton === null ? (
            <div className="status-card checking">
              <div className="spinner-sm" />
              <span>Checking...</span>
            </div>
          ) : hasFloatingButton ? (
            <div className="status-card active">
              <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Floating button active</span>
            </div>
          ) : (
            <div className="status-card fallback">
              <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Using popup scanner</span>
            </div>
          )}
        </div>
      )}

      {/* Scanner Results */}
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
              <Button onClick={scan} variant="secondary">Retry</Button>
            </div>
          ) : data ? (
            <div className="scanner-results">
              <div className="scanner-stats">
                <span><strong>{data.form_fields.length}</strong> fields</span>
                <span className="stats-divider">•</span>
                <span><strong>{data.action_buttons.length}</strong> buttons</span>
              </div>
              {(data.proposed_company_names[0] || data.proposed_job_titles[0]) && (
                <div className="metadata-compact">
                  {data.proposed_company_names[0] && (
                    <span className="metadata-company">{data.proposed_company_names[0]}</span>
                  )}
                  {data.proposed_job_titles[0] && (
                    <span className="metadata-title">{data.proposed_job_titles[0]}</span>
                  )}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      {/* Info */}
      {!isJobPortal && (
        <div className="info-card">
          <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p>Navigate to a job application page</p>
        </div>
      )}

      {/* Logout */}
      <div className="auth-actions">
        <Button variant="secondary" onClick={logout}>Sign Out</Button>
      </div>
    </div>
  );
}

// ============ SESSIONS TAB ============
function SessionsTab() {
  const [sessions, setSessions] = useState<JobSession[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    try {
      const response = await browser.runtime.sendMessage({ type: 'SESSION_LIST' });
      setSessions(response.sessions || []);
    } catch {
      setSessions([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadSessions();

    // Real-time updates: listen for session storage changes
    const storageListener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => {
      if (area === 'session' && changes['prewrite_sessions_updated']) {
        loadSessions();
      }
    };

    browser.storage.onChanged.addListener(storageListener);
    return () => browser.storage.onChanged.removeListener(storageListener);
  }, []);

  const deleteSession = async (id: string) => {
    await browser.runtime.sendMessage({ type: 'SESSION_DELETE', id });
    // loadSessions will be triggered by storage change event
  };

  const formatTime = (timestamp: number) => {
    const mins = Math.floor((Date.now() - timestamp) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  if (loading) {
    return (
      <div className="tab-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="tab-empty">
        <svg className="empty-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6z" clipRule="evenodd" />
        </svg>
        <p>No active sessions</p>
        <span className="empty-hint">Sessions are automatically created when scanning job pages</span>
      </div>
    );
  }

  return (
    <div className="sessions-tab">
      {sessions.map((session) => (
        <div key={session.id} className={`session-card ${session.parentSessionId ? 'session-linked' : ''}`}>
          <div className="session-info">
            <div className="session-header-row">
              <p className="session-company">{session.company || 'Unknown Company'}</p>
              {session.parentSessionId && (
                <span className="session-chain-badge" title="Linked from previous page">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12">
                    <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </div>
            <p className="session-title">{session.jobTitle || 'Unknown Position'}</p>
            {session.jobDescription && (
              <p className="session-desc">{session.jobDescription.slice(0, 80)}...</p>
            )}
            <div className="session-meta">
              <span className="session-time">{formatTime(session.lastAccessedAt)}</span>
              {session.pageUrls && session.pageUrls.length > 1 && (
                <span className="session-pages">{session.pageUrls.length} pages</span>
              )}
            </div>
          </div>
          <button className="session-delete" onClick={() => deleteSession(session.id)} title="Delete">
            <svg viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}

// ============ GENERATED TAB ============
function GeneratedTab() {
  const [items, setItems] = useState<GeneratedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
      const response = await browser.runtime.sendMessage({ type: 'GENERATED_LIST', limit: 10 });
      setItems(response.items || []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  };

  const downloadItem = (item: GeneratedItem) => {
    const link = document.createElement('a');
    link.href = item.url;
    link.download = `${item.type}_${item.company}.pdf`;
    link.target = '_blank';
    link.click();
  };

  const formatTime = (timestamp: number) => {
    const mins = Math.floor((Date.now() - timestamp) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  };

  if (loading) {
    return (
      <div className="tab-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="generated-tab">
      {items.length === 0 ? (
        <div className="tab-empty">
          <svg className="empty-icon" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
          <p>No generated files yet</p>
          <span className="empty-hint">Resumes and cover letters will appear here</span>
        </div>
      ) : (
        <>
          {items.map((item) => (
            <div key={item.id} className="generated-card">
              <div className="generated-icon">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="generated-info">
                <p className="generated-type">{item.type === 'resume' ? 'Resume' : 'Cover Letter'}</p>
                <p className="generated-company">{item.company} - {item.jobTitle}</p>
                <span className="generated-time">{formatTime(item.createdAt)}</span>
              </div>
              <button className="download-btn" onClick={() => downloadItem(item)} title="Download">
                <svg viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
          <a href="https://prewrite.io/generations" target="_blank" rel="noopener noreferrer" className="view-all-link">
            View All Generations →
          </a>
        </>
      )}
    </div>
  );
}

// ============ SETTINGS TAB ============
function SettingsTab() {
  const [currentUrl, setCurrentUrl] = useState('');
  const [currentDomain, setCurrentDomain] = useState('');
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);
  const [isJobPortal, setIsJobPortal] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCurrentPage = async () => {
      try {
        const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
        if (tab?.url && tab.id) {
          setCurrentUrl(tab.url);
          setCurrentDomain(new URL(tab.url).hostname);
          setCurrentTabId(tab.id);

          // Get combined site status
          const response = await browser.runtime.sendMessage({
            type: 'SITE_STATUS',
            url: tab.url
          });

          setIsJobPortal(response?.isJobPortal ?? false);
          setIsEnabled(response?.isEnabled ?? false);
        }
      } catch {
        // Ignore
      }
      setLoading(false);
    };
    loadCurrentPage();
  }, []);

  const toggleSite = async () => {
    if (!currentTabId) return;

    if (isJobPortal) {
      // Job portal: toggle blacklist
      if (isEnabled) {
        // Currently enabled → disable (add to blacklist)
        setIsEnabled(false);
        await browser.runtime.sendMessage({ type: 'BLACKLIST_ADD', url: currentDomain, blockType: 'domain' });
        // Hide floating button immediately
        try {
          await browser.tabs.sendMessage(currentTabId, { type: 'HIDE_FLOATING_BUTTON' });
        } catch {
          // Content script may not be ready, ignore
        }
      } else {
        // Currently disabled → enable (remove from blacklist)
        setIsEnabled(true);
        await browser.runtime.sendMessage({ type: 'BLACKLIST_REMOVE', url: currentUrl });
        // Try to inject floating button
        await browser.runtime.sendMessage({ type: 'INJECT_FLOATING_BUTTON', tabId: currentTabId });
      }
    } else {
      // Non-job portal: toggle allowlist
      if (isEnabled) {
        // Currently enabled → disable (remove from allowlist)
        setIsEnabled(false);
        await browser.runtime.sendMessage({ type: 'ALLOWLIST_REMOVE', url: currentUrl });
        // Hide floating button immediately
        try {
          await browser.tabs.sendMessage(currentTabId, { type: 'HIDE_FLOATING_BUTTON' });
        } catch {
          // Content script may not be ready, ignore
        }
      } else {
        // Currently disabled → enable (add to allowlist)
        setIsEnabled(true);
        await browser.runtime.sendMessage({ type: 'ALLOWLIST_ADD', url: currentDomain, blockType: 'domain' });
        // Inject floating button
        await browser.runtime.sendMessage({ type: 'INJECT_FLOATING_BUTTON', tabId: currentTabId });
      }
    }
  };

  if (loading) {
    return (
      <div className="tab-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="settings-tab">
      <div className="settings-section">
        <h3 className="settings-title">Current Site</h3>
        <p className="settings-domain">{currentDomain || 'Unknown'}</p>

        <div className="settings-toggle">
          <span>Enable Prewrite on this site</span>
          <button
            className={`toggle-switch ${isEnabled ? 'active' : ''}`}
            onClick={toggleSite}
          >
            <span className="toggle-knob" />
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3 className="settings-title">About</h3>
        <p className="settings-info">Prewrite v1.0.0</p>
        <a href="https://prewrite.io" target="_blank" rel="noopener noreferrer" className="settings-link">
          Visit Website →
        </a>
      </div>
    </div>
  );
}

// ============ LOGIN VIEW ============
function LoginView({ login }: { login: () => void }) {
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
        <Button onClick={login}>Sign In</Button>
      </div>
    </div>
  );
}

export default App;
