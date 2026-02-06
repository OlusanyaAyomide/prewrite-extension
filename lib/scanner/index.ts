/**
 * Main scanner orchestrator - combines all utilities to extract page data
 */

import type { PrewritePageData } from '@/types/schema';
import { extractFormFields } from './formFieldExtractor';
import { detectActionButtons, detectMultiPageForm } from './buttonDetector';
import { extractJobMetadata } from './metadataExtractor';

/**
 * Scans the current page and returns structured data matching the schema
 */
export function scanPage(): PrewritePageData {
  // Extract form fields
  const formFields = extractFormFields(document);
  console.log(formFields)

  // Detect action buttons
  const actionButtons = detectActionButtons(document);

  // Extract job metadata
  const metadata = extractJobMetadata();

  // Detect multi-page form
  const { isMultiPage, estimatedStep } = detectMultiPageForm(document);

  return {
    page_url: window.location.href,
    page_title: document.title,
    proposed_company_names: metadata.companies,
    proposed_job_titles: metadata.titles,
    proposed_job_descriptions: metadata.descriptions,
    form_fields: formFields,
    action_buttons: actionButtons,
    form_metadata: {
      detected_multi_page: isMultiPage,
      estimated_step: estimatedStep,
    },
  };
}

// Re-export individual utilities for testing/debugging
export { extractFormFields } from './formFieldExtractor';
export { detectActionButtons, detectMultiPageForm } from './buttonDetector';
export { extractJobMetadata } from './metadataExtractor';
export { findLabel } from './findLabel';
export { getSectionContext } from './getSectionContext';
