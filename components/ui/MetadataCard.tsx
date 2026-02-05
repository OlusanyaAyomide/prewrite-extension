import type { FormMetadata } from '@/types/schema';

interface MetadataCardProps {
  metadata: FormMetadata;
  companyNames: string[];
  jobTitles: string[];
}

export function MetadataCard({ metadata, companyNames, jobTitles }: MetadataCardProps) {
  return (
    <div className="card">
      <div className="metadata-row">
        <span className="metadata-label">Multi-page Form</span>
        <span className={`metadata-value ${metadata.detected_multi_page ? 'highlight' : ''}`}>
          {metadata.detected_multi_page ? 'Yes' : 'No'}
        </span>
      </div>

      {metadata.detected_multi_page && (
        <div className="metadata-row">
          <span className="metadata-label">Current Step</span>
          <span className="metadata-value">Step {metadata.estimated_step}</span>
        </div>
      )}

      {companyNames.length > 0 && (
        <div className="metadata-row">
          <span className="metadata-label">Company</span>
          <span className="metadata-value">{companyNames[0]}</span>
        </div>
      )}

      {jobTitles.length > 0 && (
        <div className="metadata-row">
          <span className="metadata-label">Position</span>
          <span className="metadata-value" style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {jobTitles[0]}
          </span>
        </div>
      )}
    </div>
  );
}
