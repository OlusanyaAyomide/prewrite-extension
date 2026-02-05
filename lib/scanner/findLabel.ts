/**
 * Finds the label text associated with a form element.
 * Enhanced with robust fallback strategies for modern SPAs and custom components.
 * Checks: aria-label, aria-labelledby, <label for>, parent <label>, 
 *         adjacent siblings, preceding text elements, and data attributes.
 */
export function findLabel(element: HTMLElement): string {
  // 1. Check aria-label attribute
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel?.trim()) {
    return cleanLabelText(ariaLabel);
  }

  // 2. Check aria-labelledby and find referenced element
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelIds = ariaLabelledBy.split(' ');
    const labelTexts: string[] = [];
    labelIds.forEach((id) => {
      const labelElement = document.getElementById(id);
      if (labelElement?.textContent?.trim()) {
        labelTexts.push(labelElement.textContent.trim());
      }
    });
    if (labelTexts.length > 0) {
      return cleanLabelText(labelTexts.join(' '));
    }
  }

  // 3. Check aria-describedby as secondary label source
  const ariaDescribedBy = element.getAttribute('aria-describedby');
  if (ariaDescribedBy) {
    const labelElement = document.getElementById(ariaDescribedBy);
    if (labelElement?.textContent?.trim()) {
      return cleanLabelText(labelElement.textContent);
    }
  }

  // 4. Check for <label for="id"> association
  const elementId = element.id;
  if (elementId) {
    const associatedLabel = document.querySelector(`label[for="${elementId}"]`);
    if (associatedLabel?.textContent?.trim()) {
      return cleanLabelText(associatedLabel.textContent);
    }
  }

  // 5. Check for wrapping <label> parent
  const parentLabel = element.closest('label');
  if (parentLabel) {
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    const inputs = clone.querySelectorAll('input, select, textarea, button');
    inputs.forEach((input) => input.remove());
    const labelText = clone.textContent?.trim();
    if (labelText) {
      return cleanLabelText(labelText);
    }
  }

  // 6. Search for preceding label-like elements
  const precedingLabel = findPrecedingLabelElement(element);
  if (precedingLabel) {
    return cleanLabelText(precedingLabel);
  }

  // 7. Check parent container for label-like children
  const containerLabel = findLabelInContainer(element);
  if (containerLabel) {
    return cleanLabelText(containerLabel);
  }

  // 8. Check data attributes commonly used for labels
  const dataLabel = element.getAttribute('data-label') ||
    element.getAttribute('data-name') ||
    element.getAttribute('data-field-name') ||
    element.getAttribute('data-testid');
  if (dataLabel && isLabelLike(dataLabel)) {
    return formatNameAsLabel(dataLabel);
  }

  // 9. Check title attribute
  const title = element.getAttribute('title');
  if (title?.trim()) {
    return cleanLabelText(title);
  }

  // 10. Fallback: use name or placeholder as label hint
  const name = element.getAttribute('name');
  if (name) {
    return formatNameAsLabel(name);
  }

  const placeholder = element.getAttribute('placeholder');
  if (placeholder) {
    return cleanLabelText(placeholder);
  }

  return '';
}

/**
 * Search for preceding elements that look like labels
 * Handles cases where label is a span/div before the input
 */
function findPrecedingLabelElement(element: HTMLElement): string | null {
  // Check immediate previous siblings
  let sibling = element.previousElementSibling;
  let siblingCount = 0;
  const maxSiblings = 3;

  while (sibling && siblingCount < maxSiblings) {
    const text = sibling.textContent?.trim();

    // If it's a label-like element with short text
    if (isLabelLikeElement(sibling) && text && text.length < 100) {
      if (isLabelLike(text)) {
        return text;
      }
    }

    sibling = sibling.previousElementSibling;
    siblingCount++;
  }

  // Check parent's children before this element
  const parent = element.parentElement;
  if (parent) {
    const children = Array.from(parent.children);
    const currentIndex = children.indexOf(element);

    // Look at elements before the input
    for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - 3); i--) {
      const child = children[i] as HTMLElement;
      const text = child.textContent?.trim();

      if (isLabelLikeElement(child) && text && text.length < 100) {
        if (isLabelLike(text)) {
          return text;
        }
      }
    }
  }

  return null;
}

/**
 * Search within the element's container for label-like content
 */
function findLabelInContainer(element: HTMLElement): string | null {
  // Look up to 3 levels of parents for a label
  let parent = element.parentElement;
  let level = 0;
  const maxLevels = 3;

  while (parent && level < maxLevels) {
    // Check for label elements within this container
    const labels = parent.querySelectorAll('label, [class*="label"], [class*="Label"]');
    for (const label of labels) {
      const text = label.textContent?.trim();
      if (text && text.length < 100 && isLabelLike(text)) {
        // Make sure this label isn't for a different input
        const forAttr = label.getAttribute('for');
        if (!forAttr || forAttr === element.id) {
          return text;
        }
      }
    }

    // Check for span/div with label-like text
    const spans = parent.querySelectorAll(':scope > span, :scope > div');
    for (const span of spans) {
      const text = span.textContent?.trim();
      if (text && text.length < 80 && isLabelLike(text)) {
        return text;
      }
    }

    parent = parent.parentElement;
    level++;
  }

  return null;
}

/**
 * Check if an element looks like a label container
 */
function isLabelLikeElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  const className = element.className?.toLowerCase() || '';

  return (
    tagName === 'label' ||
    tagName === 'span' ||
    tagName === 'div' ||
    tagName === 'legend' ||
    tagName === 'p' ||
    className.includes('label') ||
    className.includes('title') ||
    className.includes('field-name')
  );
}

/**
 * Check if text looks like a field label
 */
function isLabelLike(text: string): boolean {
  const normalized = text.toLowerCase().trim();

  // Labels often end with colon
  if (normalized.endsWith(':')) return true;

  // Common label keywords
  const labelKeywords = [
    'name', 'email', 'phone', 'address', 'city', 'state', 'zip', 'country',
    'first', 'last', 'middle', 'date', 'birth', 'resume', 'cv', 'cover',
    'salary', 'linkedin', 'website', 'portfolio', 'company', 'title',
    'gender', 'veteran', 'disability', 'authorization', 'sponsor',
    'experience', 'education', 'skills', 'message', 'comments', 'notes'
  ];

  return labelKeywords.some((keyword) => normalized.includes(keyword));
}

/**
 * Clean up label text (remove asterisks, extra whitespace)
 */
function cleanLabelText(text: string): string {
  return text
    .replace(/\*+/g, '') // Remove required asterisks
    .replace(/\s*:\s*$/, '') // Remove trailing colon
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Converts a field name (e.g., "first_name" or "firstName") to a readable label
 */
function formatNameAsLabel(name: string): string {
  return name
    .replace(/^(data-|field-)/i, '') // Remove common prefixes
    .replace(/([A-Z])/g, ' $1') // camelCase to spaces
    .replace(/[_-]/g, ' ') // snake_case/kebab-case to spaces
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
