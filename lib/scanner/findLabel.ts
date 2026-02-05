/**
 * Finds the label text associated with a form element.
 * Checks: aria-label, aria-labelledby, <label for>, parent <label>, adjacent siblings
 */
export function findLabel(element: HTMLElement): string {
  // 1. Check aria-label attribute
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel?.trim()) {
    return ariaLabel.trim();
  }

  // 2. Check aria-labelledby and find referenced element
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelElement = document.getElementById(ariaLabelledBy);
    if (labelElement?.textContent?.trim()) {
      return labelElement.textContent.trim();
    }
  }

  // 3. Check for <label for="id"> association
  const elementId = element.id;
  if (elementId) {
    const associatedLabel = document.querySelector(`label[for="${elementId}"]`);
    if (associatedLabel?.textContent?.trim()) {
      return associatedLabel.textContent.trim();
    }
  }

  // 4. Check for wrapping <label> parent
  const parentLabel = element.closest('label');
  if (parentLabel) {
    // Get text content excluding the input element itself
    const clone = parentLabel.cloneNode(true) as HTMLElement;
    const inputs = clone.querySelectorAll('input, select, textarea');
    inputs.forEach((input) => input.remove());
    const labelText = clone.textContent?.trim();
    if (labelText) {
      return labelText;
    }
  }

  // 5. Check adjacent sibling elements (previous siblings first)
  const previousSibling = element.previousElementSibling;
  if (previousSibling?.tagName === 'LABEL' || previousSibling?.tagName === 'SPAN') {
    const text = previousSibling.textContent?.trim();
    if (text) {
      return text;
    }
  }

  // 6. Check parent's first child if it's a label-like element
  const parent = element.parentElement;
  if (parent) {
    const firstChild = parent.firstElementChild;
    if (firstChild && firstChild !== element &&
      (firstChild.tagName === 'LABEL' || firstChild.tagName === 'SPAN')) {
      const text = firstChild.textContent?.trim();
      if (text) {
        return text;
      }
    }
  }

  // 7. Fallback: use name or placeholder as label hint
  const name = element.getAttribute('name');
  if (name) {
    return formatNameAsLabel(name);
  }

  return '';
}

/**
 * Converts a field name (e.g., "first_name" or "firstName") to a readable label
 */
function formatNameAsLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1') // camelCase to spaces
    .replace(/[_-]/g, ' ') // snake_case/kebab-case to spaces
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
