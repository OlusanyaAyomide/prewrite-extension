import type { FormField } from '@/types/schema';
import { FieldBadge } from './FieldBadge';

interface FieldPreviewListProps {
  fields: FormField[];
}

export function FieldPreviewList({ fields }: FieldPreviewListProps) {
  if (fields.length === 0) {
    return (
      <div className="empty-state">
        <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>No fields detected</p>
        <p className="hint">Click "Scan Page" to detect form fields</p>
      </div>
    );
  }

  return (
    <div>
      {fields.map((field, index) => (
        <div key={field.field_id || index} className="field-item">
          <div className="field-info">
            <div className="field-header">
              <SuccessCheckmark />
              <span className="field-label">
                {field.field_label || field.field_name || 'Unnamed field'}
              </span>
            </div>
            {field.field_context && (
              <p className="field-context">{field.field_context}</p>
            )}
            {field.field_placeholder && (
              <p className="field-placeholder">Placeholder: "{field.field_placeholder}"</p>
            )}
          </div>
          <FieldBadge type={field.field_type} />
        </div>
      ))}
    </div>
  );
}

function SuccessCheckmark() {
  return (
    <svg className="icon icon-success" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}
