import type { FormField } from './schema';

/**
 * Job session stored during application flow
 */
export interface JobSession {
  id: string;
  domain: string;
  jobIdentifier: string;
  company: string | null;
  jobTitle: string | null;
  jobDescription: string | null;
  formFields: FormField[];
  createdAt: number;
  lastAccessedAt: number;
}

/**
 * Response from POST /completions
 */
export interface AutofillResponse {
  completion_session_ref: string;
  is_multi_step: boolean;
  job_id: string | null;
  autofill_data: AutofillField[];
}

/**
 * Single field value from autofill response
 */
export interface AutofillField {
  field_id: string;
  field_value: string | null;
  field_type?: string;
}

/**
 * Response from GET /completions/result/:jobId
 */
export interface CompletionResult {
  overall_match: number;
  can_apply: boolean;
  generated_content: {
    resume: GeneratedFile | null;
    cover_letter: GeneratedFile | null;
    job_description_required: boolean;
  };
  completions_reference: string;
}

/**
 * Generated file (resume/cover letter)
 */
export interface GeneratedFile {
  field_id: string;
  field_value: string; // URL
}

/**
 * Item stored in generated content history
 */
export interface GeneratedItem {
  id: string;
  type: 'resume' | 'cover_letter';
  url: string;
  jobTitle: string;
  company: string;
  createdAt: number;
}

/**
 * Domain blacklist entry
 */
export interface BlacklistEntry {
  url: string;
  type: 'page' | 'domain';
  addedAt: number;
}
