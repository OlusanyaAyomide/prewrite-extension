import { useState } from 'react';
import { useTheme, useScanner } from '@/hooks';
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
  const { data, isLoading, error, scan } = useScanner();
  const [showCopied, setShowCopied] = useState(false);

  const handleGenerateApiCall = () => {
    if (data) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  return (
    <div className="popup-container">
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
            <p className="header-subtitle">Form Scanner</p>
          </div>
        </div>
        <ThemeToggle isDark={isDark} onToggle={toggle} />
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Action Bar */}
        <div className="action-bar">
          <Button onClick={scan} isLoading={isLoading}>
            {isLoading ? 'Scanning...' : 'Scan Page'}
          </Button>

          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Results */}
        {data && (
          <>
            {/* Stats Bar */}
            <div className="stats-bar">
              <span>
                <span className="stat-value">{data.form_fields.length}</span> fields
              </span>
              <span className="stats-divider">•</span>
              <span>
                <span className="stat-value">{data.action_buttons.length}</span> buttons
              </span>
            </div>

            {/* Metadata */}
            <div className="px-4 pb-3">
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

            {/* Action Buttons */}
            {data.action_buttons.length > 0 && (
              <div>
                <p className="section-header">Detected Actions</p>
                <ActionButtonList buttons={data.action_buttons} />
              </div>
            )}

            {/* Fields List */}
            <div className="field-list">
              <p className="section-header">Form Fields</p>
              <FieldPreviewList fields={data.form_fields} />
            </div>
          </>
        )}

        {/* Empty State */}
        {!data && !isLoading && !error && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FieldPreviewList fields={[]} />
          </div>
        )}
      </main>

      {/* Footer */}
      {data && (
        <footer className="footer">
          <Button onClick={handleGenerateApiCall} variant="secondary">
            {showCopied ? (
              <>
                <svg className="icon icon-success" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Copied to Clipboard!
              </>
            ) : (
              <>
                <svg className="icon" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                  <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                </svg>
                Generate API Call
              </>
            )}
          </Button>
        </footer>
      )}
    </div>
  );
}

export default App;
