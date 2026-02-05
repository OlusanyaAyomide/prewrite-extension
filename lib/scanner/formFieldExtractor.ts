import type { FormField, FieldOption, FieldType } from '@/types/schema';
import { findLabel } from './findLabel';
import { getSectionContext } from './getSectionContext';

/**
 * Extracts all form fields from the page, including those in Shadow DOM
 * Uses recursive deep traversal to pierce all shadow boundaries
 */
export function extractFormFields(root: Document | ShadowRoot = document): FormField[] {
  const fields: FormField[] = [];
  const seen = new Set<Element>(); // Prevent duplicates

  // Deep recursive function to traverse all elements including shadow roots
  function traverse(node: Document | ShadowRoot | Element): void {
    // Get all form elements at this level
    if ('querySelectorAll' in node) {
      const formElements = node.querySelectorAll('input, select, textarea');
      formElements.forEach((element) => {
        if (!seen.has(element)) {
          seen.add(element);
          const field = processFormElement(element as HTMLElement);
          if (field) {
            fields.push(field);
          }
        }
      });

      // Traverse all child elements looking for shadow roots
      const allElements = node.querySelectorAll('*');
      allElements.forEach((el) => {
        // Check for shadow root (open shadows)
        if (el.shadowRoot) {
          traverse(el.shadowRoot);
        }
      });
    }
  }

  // Start traversal
  traverse(root);

  // Also check for elements with custom element patterns (common in React/Vue)
  const customInputs = root.querySelectorAll('[role="textbox"], [role="combobox"], [role="listbox"], [contenteditable="true"]');
  customInputs.forEach((element) => {
    if (!seen.has(element)) {
      seen.add(element);
      const field = processCustomElement(element as HTMLElement);
      if (field) {
        fields.push(field);
      }
    }
  });

  return fields;
}

/**
 * Process custom elements that act like inputs (contenteditable, ARIA roles)
 */
function processCustomElement(element: HTMLElement): FormField | null {
  const role = element.getAttribute('role');
  const fieldId = element.id || `prewrite-custom-${Math.random().toString(36).slice(2, 8)}`;
  const fieldLabel = findLabel(element);

  let fieldType: FieldType = 'text';
  if (role === 'combobox' || role === 'listbox') {
    fieldType = 'select';
  } else if (element.getAttribute('contenteditable') === 'true') {
    fieldType = 'textarea';
  }

  return {
    field_id: fieldId,
    field_name: element.getAttribute('name') || '',
    field_type: fieldType,
    field_label: fieldLabel,
    field_placeholder: element.getAttribute('placeholder') || element.getAttribute('aria-placeholder') || null,
    field_options: null,
    field_context: getSectionContext(element),
  };
}

/**
 * Processes a single form element into a FormField
 */
function processFormElement(element: HTMLElement): FormField | null {
  const tagName = element.tagName.toLowerCase();

  // Skip hidden and submit inputs
  if (element instanceof HTMLInputElement) {
    const type = element.type.toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) {
      return null;
    }
  }

  const fieldId = element.id || generateFieldId(element);
  const fieldName = element.getAttribute('name') || '';
  const fieldType = getFieldType(element);
  const fieldLabel = findLabel(element);
  const fieldPlaceholder = element.getAttribute('placeholder') || null;
  const fieldOptions = getFieldOptions(element);
  const fieldContext = getSectionContext(element);

  return {
    field_id: fieldId,
    field_name: fieldName,
    field_type: fieldType,
    field_label: fieldLabel,
    field_placeholder: fieldPlaceholder,
    field_options: fieldOptions,
    field_context: fieldContext,
  };
}

/**
 * Determines the field type from the element
 */
function getFieldType(element: HTMLElement): FieldType {
  const tagName = element.tagName.toLowerCase();

  if (tagName === 'textarea') {
    return 'textarea';
  }

  if (tagName === 'select') {
    return 'select';
  }

  if (tagName === 'input') {
    const inputType = (element as HTMLInputElement).type.toLowerCase();
    const typeMap: Record<string, FieldType> = {
      text: 'text',
      email: 'email',
      tel: 'tel',
      url: 'url',
      number: 'number',
      date: 'date',
      'datetime-local': 'date',
      month: 'date',
      week: 'date',
      time: 'date',
      file: 'file',
      checkbox: 'checkbox',
      radio: 'radio',
    };
    return typeMap[inputType] || 'text';
  }

  return 'text';
}

/**
 * Extracts options from select elements or datalists
 */
function getFieldOptions(element: HTMLElement): FieldOption[] | null {
  if (element.tagName.toLowerCase() === 'select') {
    const select = element as HTMLSelectElement;
    const options: FieldOption[] = [];

    Array.from(select.options).forEach((option) => {
      // Skip placeholder options
      if (option.value || option.text !== option.defaultSelected.toString()) {
        options.push({
          value: option.value,
          label: option.text.trim(),
        });
      }
    });

    return options.length > 0 ? options : null;
  }

  // Check for associated datalist
  if (element instanceof HTMLInputElement && element.list) {
    const datalist = element.list;
    const options: FieldOption[] = [];

    Array.from(datalist.options).forEach((option) => {
      options.push({
        value: option.value,
        label: option.text || option.value,
      });
    });

    return options.length > 0 ? options : null;
  }

  return null;
}

/**
 * Generates a unique field ID for elements without IDs
 */
function generateFieldId(element: HTMLElement): string {
  const name = element.getAttribute('name') || '';
  const type = element.tagName.toLowerCase();
  const index = Array.from(document.querySelectorAll(element.tagName)).indexOf(element);
  return `prewrite-${type}-${name || index}`;
}
