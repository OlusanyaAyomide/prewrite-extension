/**
 * Finds the section context for a form element by looking for
 * the nearest heading (h1-h4) or fieldset legend.
 */
export function getSectionContext(element: HTMLElement): string {
  // 1. Check if element is within a fieldset with legend
  const fieldset = element.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend?.textContent?.trim()) {
      return legend.textContent.trim();
    }
  }

  // 2. Walk up the DOM tree looking for section headings
  let current: HTMLElement | null = element;

  while (current && current !== document.body) {
    // Check siblings before this element for headings
    let sibling = current.previousElementSibling;
    while (sibling) {
      const heading = findHeadingInElement(sibling as HTMLElement);
      if (heading) {
        return heading;
      }
      sibling = sibling.previousElementSibling;
    }

    // Check parent's heading if it's a section-like container
    const parent = current.parentElement;
    if (parent) {
      // Check for direct heading child before current element
      const children = Array.from(parent.children);
      const currentIndex = children.indexOf(current);

      for (let i = currentIndex - 1; i >= 0; i--) {
        const heading = findHeadingInElement(children[i] as HTMLElement);
        if (heading) {
          return heading;
        }
      }

      // Check parent's aria-label or data attributes
      const sectionLabel = parent.getAttribute('aria-label') ||
        parent.getAttribute('data-section');
      if (sectionLabel?.trim()) {
        return sectionLabel.trim();
      }
    }

    current = current.parentElement;
  }

  return '';
}

/**
 * Finds heading text within an element (h1-h4)
 */
function findHeadingInElement(element: HTMLElement): string | null {
  // Check if element itself is a heading
  if (/^H[1-4]$/.test(element.tagName)) {
    return element.textContent?.trim() || null;
  }

  // Check for heading children
  const heading = element.querySelector('h1, h2, h3, h4');
  if (heading?.textContent?.trim()) {
    return heading.textContent.trim();
  }

  // Check for elements with heading-like classes
  const headingLike = element.querySelector('[class*="title"], [class*="heading"], [class*="header"]');
  if (headingLike?.textContent?.trim()) {
    return headingLike.textContent.trim();
  }

  return null;
}
