import { useTheme, useAuth } from '@/hooks';
import { Button, ThemeToggle } from '@/components/ui';
import '@/assets/styles.css';

function App() {
  const { isDark, toggle } = useTheme();
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

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
        {isLoading ? (
          <div className="auth-loading">
            <div className="spinner" />
            <p>Loading...</p>
          </div>
        ) : isAuthenticated && user ? (
          <AuthenticatedView user={user} logout={logout} />
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
}

function AuthenticatedView({ user, logout }: AuthenticatedViewProps) {
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

      {/* Activation Toggle */}
      <div className="activation-section">
        <div className="activation-row">
          <div>
            <p className="activation-label">Active on this page</p>
            <p className="activation-hint">Prewrite will assist on job portals</p>
          </div>
          <button className="toggle-btn active" disabled>
            <span className="toggle-track">
              <span className="toggle-thumb" />
            </span>
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="info-card">
        <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <p>Look for the floating Prewrite button on job application pages!</p>
      </div>

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
