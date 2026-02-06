import type { AutofillField, FormField } from '@/types/schema';

/**
 * Field Filler - Applies autofill data to form fields with auto-detection and visual feedback
 */

/**
 * Apply autofill fields to the DOM
 */
export function applyAutofill(
  autofillFields: AutofillField[],
  formFields: FormField[],
  options: { highlight?: boolean } = { highlight: true }
): { filled: number; skipped: number } {
  let filled = 0;
  let skipped = 0;

  for (const field of autofillFields) {
    if (!field.field_value) {
      skipped++;
      continue;
    }

    // Try to find the element
    const element = findElement(field.field_id, formFields);

    if (element) {
      const success = fillElement(element, field.field_value, field.field_type);
      if (success) {
        filled++;
        if (options.highlight) {
          highlightElement(element);
        }
      } else {
        skipped++;
      }
    } else {
      // Try auto-detect by label matching
      const matchedField = autoDetectField(field, formFields);
      if (matchedField) {
        const matchedElement = findElement(matchedField.field_id, formFields);
        if (matchedElement) {
          const success = fillElement(matchedElement, field.field_value, field.field_type);
          if (success) {
            filled++;
            if (options.highlight) {
              highlightElement(matchedElement);
            }
          } else {
            skipped++;
          }
        } else {
          skipped++;
        }
      } else {
        skipped++;
        console.log('[Prewrite] Could not find element for field:', field.field_id);
      }
    }
  }

  return { filled, skipped };
}

/**
 * Find element by various selectors
 */
function findElement(fieldId: string, formFields: FormField[]): HTMLElement | null {
  // Try by ID
  let element = document.getElementById(fieldId);
  if (element) return element;

  // Try by name
  element = document.querySelector(`[name="${fieldId}"]`) as HTMLElement;
  if (element) return element;

  // Try by data attribute
  element = document.querySelector(`[data-field-id="${fieldId}"]`) as HTMLElement;
  if (element) return element;

  // Try by label text (find input associated with label)
  const formField = formFields.find(f => f.field_id === fieldId);
  if (formField?.field_label) {
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      if (label.textContent?.toLowerCase().includes(formField.field_label.toLowerCase())) {
        const forId = label.getAttribute('for');
        if (forId) {
          element = document.getElementById(forId);
          if (element) return element;
        }
        // Check for nested input
        const nestedInput = label.querySelector('input, select, textarea');
        if (nestedInput) return nestedInput as HTMLElement;
      }
    }
  }

  return null;
}

/**
 * Auto-detect field by label similarity
 */
function autoDetectField(
  autofillField: AutofillField,
  formFields: FormField[]
): FormField | null {
  // Common field mappings
  const fieldMappings: Record<string, string[]> = {
    first_name: ['first name', 'firstname', 'given name', 'prenom'],
    last_name: ['last name', 'lastname', 'surname', 'family name', 'nom'],
    email: ['email', 'e-mail', 'email address'],
    phone: ['phone', 'telephone', 'mobile', 'cell'],
    address: ['address', 'street', 'location'],
    city: ['city', 'town'],
    state: ['state', 'province', 'region'],
    zip: ['zip', 'postal', 'postcode'],
    country: ['country', 'nation'],
    linkedin: ['linkedin', 'linkedin url'],
    github: ['github', 'github url'],
    portfolio: ['portfolio', 'website', 'personal site'],
    resume: ['resume', 'cv', 'curriculum vitae'],
    cover_letter: ['cover letter', 'cover', 'letter'],
  };

  const fieldIdLower = autofillField.field_id.toLowerCase().replace(/[_-]/g, ' ');

  // Check if this is a known field type
  for (const [key, aliases] of Object.entries(fieldMappings)) {
    if (aliases.some(a => fieldIdLower.includes(a)) || fieldIdLower.includes(key)) {
      // Find matching form field
      for (const formField of formFields) {
        const labelLower = (formField.field_label || formField.field_name || '').toLowerCase();
        if (aliases.some(a => labelLower.includes(a)) || labelLower.includes(key)) {
          return formField;
        }
      }
    }
  }

  return null;
}

/**
 * Fill an element with a value
 */
function fillElement(
  element: HTMLElement,
  value: string,
  fieldType?: string
): boolean {
  try {
    if (element instanceof HTMLInputElement) {
      if (element.type === 'file') {
        // File inputs can't be filled directly - return false and handle separately
        console.log('[Prewrite] File input detected, skipping:', element.name || element.id);
        return false;
      }

      // Set value
      element.value = value;
      element.setAttribute('value', value);

      // Dispatch events for React/Vue/Angular
      dispatchInputEvents(element);
      return true;
    }

    if (element instanceof HTMLTextAreaElement) {
      element.value = value;
      dispatchInputEvents(element);
      return true;
    }

    if (element instanceof HTMLSelectElement) {
      // Try to find matching option
      const options = Array.from(element.options);
      const match = options.find(opt =>
        opt.value.toLowerCase() === value.toLowerCase() ||
        opt.textContent?.toLowerCase() === value.toLowerCase()
      );

      if (match) {
        element.value = match.value;
        dispatchInputEvents(element);
        return true;
      }
      return false;
    }

    // Handle contenteditable
    if (element.getAttribute('contenteditable') === 'true') {
      element.textContent = value;
      dispatchInputEvents(element);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Prewrite] Error filling element:', error);
    return false;
  }
}

/**
 * Dispatch input events for framework compatibility
 */
function dispatchInputEvents(element: HTMLElement): void {
  // Input event
  const inputEvent = new Event('input', { bubbles: true, cancelable: true });
  element.dispatchEvent(inputEvent);

  // Change event
  const changeEvent = new Event('change', { bubbles: true, cancelable: true });
  element.dispatchEvent(changeEvent);

  // Blur event (some frameworks need this)
  const blurEvent = new FocusEvent('blur', { bubbles: true });
  element.dispatchEvent(blurEvent);

  // For React specifically
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;

  if (nativeInputValueSetter && element instanceof HTMLInputElement) {
    nativeInputValueSetter.call(element, element.value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

/**
 * Highlight filled element with visual feedback
 */
function highlightElement(element: HTMLElement): void {
  // Add highlight class
  element.classList.add('prewrite-filled');

  // Also apply inline styles for shadow DOM compatibility
  const originalBoxShadow = element.style.boxShadow;
  const originalBackground = element.style.backgroundColor;
  const originalTransition = element.style.transition;

  element.style.transition = 'box-shadow 0.3s, background-color 0.3s';
  element.style.boxShadow = '0 0 0 3px rgba(75, 191, 180, 0.6)';
  element.style.backgroundColor = 'rgba(75, 191, 180, 0.1)';

  // Remove after animation
  setTimeout(() => {
    element.style.boxShadow = originalBoxShadow;
    element.style.backgroundColor = originalBackground;
    element.style.transition = originalTransition;
    element.classList.remove('prewrite-filled');
  }, 2000);
}

/**
 * Trigger download for file URL (for resume/cover letter)
 */
export function downloadFile(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
