import type { ActionButton, ButtonType } from '@/types/schema';

/**
 * Patterns for detecting button types
 */
const SUBMIT_PATTERNS = [
  /submit/i,
  /save/i,
  /send/i,
  /finish/i,
  /complete/i,
  /confirm/i,
];

const NAVIGATION_PATTERNS = [
  /next/i,
  /continue/i,
  /proceed/i,
  /apply/i,
  /go\s*to/i,
  /move\s*on/i,
  /advance/i,
  /forward/i,
  /start/i,
  /begin/i,
  /get\s*started/i,
  /let'?s?\s*go/i,
  /open/i,
  /view/i,
  /explore/i,
  /discover/i,
  /see\s*(more|details|all)/i,
  /learn\s*more/i,
  /read\s*more/i,
  /visit/i,
  /go\s*now/i,
  /try\s*(now|it)/i,
  /sign\s*up/i,
  /register/i,
  /join/i,
  /accept/i,
  /agree/i,
  /enter/i,
  /launch/i,
  /take\s*me/i,
  /show/i,
  /click\s*here/i,
];

const PREVIOUS_PATTERNS = [
  /back/i,
  /previous/i,
  /prev/i,
  /return/i,
  /go\s*back/i,
];

/**
 * Patterns specifically for application-flow navigation.
 * These are used to identify links and buttons that likely take the user
 * to the next step in a job application (as opposed to generic navigation).
 * Used for SPA dispatch tracking.
 */
const APPLICATION_FLOW_PATTERNS = [
  /\bapply\b/i,
  /\bapply\s*now\b/i,
  /\bapply\s*for\s*(this|the)?\s*(job|position|role)?\b/i,
  /\bstart\s*application\b/i,
  /\bbegin\s*application\b/i,
  /\bsubmit\s*application\b/i,
  /\bget\s*started\b/i,
  /\bstart\s*now\b/i,
  /\bnext\s*step\b/i,
  /\bnext\b/i,
  /\bcontinue\b/i,
  /\bcontinue\s*application\b/i,
  /\bcontinue\s*to\s*apply\b/i,
  /\bproceed\b/i,
  /\bproceed\s*to\b/i,
  /\bgo\s*to\s*application\b/i,
  /\bsubmit\s*&?\s*continue\b/i,
  /\bsave\s*&?\s*continue\b/i,
  /\bsave\s*&?\s*next\b/i,
  /\beasy\s*apply\b/i,
  /\bquick\s*apply\b/i,
  /\bone[\s-]*click\s*apply\b/i,
  /\bapply\s*with\b/i,
  /\bapply\s*on\s*(company|employer)\b/i,
  /\bapply\s*externally\b/i,
  /\bapply\s*via\b/i,
  /\bsign\s*up\s*&?\s*apply\b/i,
  /\bregister\s*&?\s*apply\b/i,
  /\bforward/i,
  /\badvance\b/i,
  /\benter\s*application\b/i,
  /\blaunch\s*application\b/i,
  /\bview\s*application\b/i,
  /\bopen\s*application\b/i,
  /\baccept\s*&?\s*continue\b/i,
  /\bi'?m\s*interested\b/i,
  /\bexpress\s*interest\b/i,
];

/**
 * Detects action buttons and classifies them as SUBMIT, PREVIOUS, or NAVIGATION
 */
export function detectActionButtons(
  root: Document | ShadowRoot = document,
): ActionButton[] {
  const buttons: ActionButton[] = [];

  // Query all likely button elements
  const selectors = [
    'button',
    'input[type="submit"]',
    'input[type="button"]',
    '[role="button"]',
    'a.btn',
    'a.button',
  ].join(', ');

  const elements = root.querySelectorAll(selectors);

  elements.forEach((element, index) => {
    const el = element as HTMLElement;
    const text = getButtonText(el);
    if (!text) return;

    const type = classifyButton(el, text);
    if (!type) return;

    buttons.push({
      button_id: el.id || `btn_${index}`,
      button_type: type,
      button_text: text,
      selector: generateSelector(el),
    });
  });

  return buttons;
}

/**
 * Helper to get button text from various sources
 */
function getButtonText(el: HTMLElement): string {
  return (
    el.textContent?.trim() ||
    (el as HTMLInputElement).value ||
    el.getAttribute('aria-label') ||
    el.title ||
    ''
  );
}

/**
 * Classify a button as SUBMIT, PREVIOUS, or NAVIGATION
 */
function classifyButton(el: HTMLElement, text: string): ButtonType | null {
  const ariaLabel = el.getAttribute('aria-label') || '';
  const title = el.title || '';
  const combinedText = `${text.toLowerCase()} ${ariaLabel.toLowerCase()} ${title.toLowerCase()}`;

  // Check SUBMIT first (highest priority)
  for (const pattern of SUBMIT_PATTERNS) {
    if (pattern.test(combinedText)) return 'SUBMIT';
  }

  // Check PREVIOUS
  for (const pattern of PREVIOUS_PATTERNS) {
    if (pattern.test(combinedText)) return 'PREVIOUS';
  }

  // Check NAVIGATION
  for (const pattern of NAVIGATION_PATTERNS) {
    if (pattern.test(combinedText)) return 'NAVIGATION';
  }

  return null;
}

/**
 * Generate a CSS selector for a button element
 */
function generateSelector(el: HTMLElement): string {
  if (el.id) return `#${el.id}`;
  if (el.className && typeof el.className === 'string') {
    const classes = el.className
      .split(' ')
      .filter(Boolean)
      .map((c) => `.${c}`)
      .join('');
    if (classes) return `${el.tagName.toLowerCase()}${classes}`;
  }
  return el.tagName.toLowerCase();
}

/**
 * Detect if form has multi-page navigation
 */
export function detectMultiPageForm(
  root: Document | ShadowRoot = document,
): boolean {
  const buttons = detectActionButtons(root);
  return buttons.some(
    (b) => b.button_type === 'PREVIOUS' || b.button_type === 'NAVIGATION',
  );
}

/**
 * Detects all navigation links on the page.
 * Scans <a href>, <span> with onclick/href-like behavior, and link-like elements.
 * Returns an array of absolute URLs.
 */
export function detectNavigationLinks(root: Document | ShadowRoot = document): string[] {
  const links = new Set<string>();
  const baseUrl = window.location.origin;

  // Collect all <a> elements with href
  const anchors = root.querySelectorAll('a[href]');
  anchors.forEach((a) => {
    const href = (a as HTMLAnchorElement).href;
    if (href && !href.startsWith('javascript:') && !href.startsWith('#') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
      try {
        const url = new URL(href, baseUrl);
        // Only keep same-origin links (same domain application flows)
        if (url.origin === baseUrl) {
          links.add(url.href);
        }
      } catch {
        // Invalid URL, skip
      }
    }
  });

  // Collect <span>, <div>, <li> elements that look like links
  // (have onclick, cursor:pointer, role="link", or data-href)
  const linkLikeSelectors = [
    'span[onclick]',
    'div[onclick]',
    'li[onclick]',
    'span[role="link"]',
    'div[role="link"]',
    '[data-href]',
    '[data-url]',
    '[data-link]',
  ].join(', ');

  const linkLikeElements = root.querySelectorAll(linkLikeSelectors);
  linkLikeElements.forEach((el) => {
    // Check for data-href, data-url, data-link attributes
    const dataHref = el.getAttribute('data-href') || el.getAttribute('data-url') || el.getAttribute('data-link');
    if (dataHref) {
      try {
        const url = new URL(dataHref, baseUrl);
        if (url.origin === baseUrl) {
          links.add(url.href);
        }
      } catch {
        // Invalid URL, skip
      }
    }
  });

  return Array.from(links);
}

/**
 * Detects SPA navigation elements — buttons AND <a> links whose text matches
 * application-flow patterns (e.g. "Apply Now", "Continue", "Next Step").
 * These are candidates for SPA dispatch tracking.
 *
 * Unlike the broad NAVIGATION_PATTERNS, APPLICATION_FLOW_PATTERNS only match
 * text that signals the user is moving through a job application, NOT generic
 * site navigation like "View", "Explore", or "See More".
 */
export function detectSpaElements(root: Document | ShadowRoot = document): HTMLElement[] {
  const spaElements: HTMLElement[] = [];

  // 1) Buttons (non-submit, non-anchor-wrapped)
  const buttonSelectors = [
    'button',
    'input[type="button"]',
    '[role="button"]',
  ].join(', ');

  const buttonElements = root.querySelectorAll(buttonSelectors);
  buttonElements.forEach((element) => {
    const el = element as HTMLElement;

    // Skip submit buttons
    if (el.getAttribute('type') === 'submit') return;

    // Skip if inside an <a> tag (the <a> itself will be checked below)
    if (el.closest('a')) return;

    if (matchesApplicationFlow(el)) {
      spaElements.push(el);
    }
  });

  // 2) <a> links with application-flow text
  const anchors = root.querySelectorAll('a[href]');
  anchors.forEach((element) => {
    const el = element as HTMLAnchorElement;
    const href = el.href;

    // Skip non-navigable hrefs
    if (!href || href.startsWith('javascript:') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;

    if (matchesApplicationFlow(el)) {
      spaElements.push(el);
    }
  });

  return spaElements;
}

/**
 * Check if an element's text matches application-flow patterns
 */
function matchesApplicationFlow(el: HTMLElement): boolean {
  const text = getButtonText(el);
  const ariaLabel = el.getAttribute('aria-label') || '';
  const combinedText = `${text.toLowerCase()} ${ariaLabel.toLowerCase()}`;

  return APPLICATION_FLOW_PATTERNS.some((p) => p.test(combinedText));
}
