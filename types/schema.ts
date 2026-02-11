/**
 * Type definitions for the Prewrite page data schema
 */

export type FieldType = 'text' | 'number' | 'select' | 'textarea' | 'file' | 'date' | 'checkbox' | 'radio' | 'email' | 'tel' | 'url';

export type ButtonType = 'SUBMIT' | 'PREVIOUS' | 'NAVIGATION';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FormField {
  field_id: string;
  field_name: string;
  field_type: FieldType;
  field_label: string;
  field_placeholder: string | null;
  field_options: FieldOption[] | null;
  field_context: string;
}

export interface ActionButton {
  button_id: string;
  button_type: ButtonType;
  button_text: string;
  selector: string;
}

export interface FormMetadata {
  detected_multi_page: boolean;
  estimated_step: number;
}

export interface JobListDetection {
  is_job_list_page: boolean;
  confidence: number;
  estimated_job_count: number;
}

export interface PrewritePageData {
  page_url: string;
  page_title: string;
  proposed_company_names: string[];
  proposed_job_titles: string[];
  proposed_job_descriptions: string[];
  form_fields: FormField[];
  action_buttons: ActionButton[];
  navigation_links: string[];
  form_metadata: FormMetadata;
  job_list_detection: JobListDetection;
}

/**
 * Message types for communication between popup and content script
 */
export interface ScanRequestMessage {
  type: 'SCAN_PAGE';
}

export interface ScanResponseMessage {
  type: 'SCAN_RESULT';
  data: PrewritePageData;
}

export type ExtensionMessage = ScanRequestMessage | ScanResponseMessage;

// Re-export autofill types
export type {
  JobSession,
  AutofillResponse,
  AutofillField,
  CompletionResult,
  GeneratedFile,
  GeneratedItem,
  BlacklistEntry,
} from './autofill';

