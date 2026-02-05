import type { ActionButton, ButtonType } from '@/types/schema';

/**
 * Patterns for detecting button types
 */
const SUBMIT_PATTERNS = [
  /submit/i,
  /next/i,
  /continue/i,
  /save/i,
  /apply/i,
  /send/i,
  /finish/i,
  /complete/i,
  /confirm/i,
  /proceed/i,
];

const PREVIOUS_PATTERNS = [
  /back/i,
  /previous/i,
  /prev/i,
  /return/i,
  /go\s*back/i,
];

/**
 * Detects action buttons and classifies them as SUBMIT or PREVIOUS
 */
export function detectActionButtons(root: Document | ShadowRoot = document): ActionButton[] {
  const buttons: ActionButton[] = [];

  // Query all button-like elements
  const selectors = [
    'button',
    'input[type="submit"]',
    'input[type="button"]',
    'a[role="button"]',
    '[role="button"]',
  ].join(', ');

  const elements = root.querySelectorAll(selectors);

  elements.forEach((element) => {
    const button = processButtonElement(element as HTMLElement);
    if (button) {
      buttons.push(button);
    }
  });

  // Recursively scan Shadow DOMs
  const allElements = root.querySelectorAll('*');
  allElements.forEach((el) => {
    if (el.shadowRoot) {
      buttons.push(...detectActionButtons(el.shadowRoot));
    }
  });

  return buttons;
}

/**
 * Processes a button element and classifies its type
 */
function processButtonElement(element: HTMLElement): ActionButton | null {
  const buttonText = getButtonText(element);
  const buttonType = classifyButton(buttonText, element);

  if (!buttonType) {
    return null;
  }

  const buttonId = element.id || generateButtonId(element, buttonType);

  return {
    button_id: buttonId,
    button_type: buttonType,
  };
}

/**
 * Extracts the button's text content
 */
function getButtonText(element: HTMLElement): string {
  // For input elements, use value attribute
  if (element instanceof HTMLInputElement) {
    return element.value || '';
  }

  // For other elements, use text content
  return element.textContent?.trim() || '';
}

/**
 * Classifies a button as SUBMIT or PREVIOUS based on its text and attributes
 */
function classifyButton(text: string, element: HTMLElement): ButtonType | null {
  const textLower = text.toLowerCase();
  const ariaLabel = element.getAttribute('aria-label') || '';
  const type = element.getAttribute('type') || '';
  const combinedText = `${textLower} ${ariaLabel.toLowerCase()}`;

  // Check for submit type attribute
  if (type === 'submit') {
    return 'SUBMIT';
  }

  // Check for previous patterns first (more specific)
  for (const pattern of PREVIOUS_PATTERNS) {
    if (pattern.test(combinedText)) {
      return 'PREVIOUS';
    }
  }

  // Check for submit patterns
  for (const pattern of SUBMIT_PATTERNS) {
    if (pattern.test(combinedText)) {
      return 'SUBMIT';
    }
  }

  return null;
}

/**
 * Generates a unique button ID
 */
function generateButtonId(element: HTMLElement, type: ButtonType): string {
  const index = Array.from(document.querySelectorAll('button, input[type="submit"]')).indexOf(element);
  return `prewrite-btn-${type.toLowerCase()}-${index}`;
}

/**
 * Checks if the page appears to have multi-step form navigation
 */
export function detectMultiPageForm(root: Document | ShadowRoot = document): { isMultiPage: boolean; estimatedStep: number } {
  const buttons = detectActionButtons(root);

  // If we have both next and previous buttons, likely multi-page
  const hasNext = buttons.some((b) => b.button_type === 'SUBMIT');
  const hasPrevious = buttons.some((b) => b.button_type === 'PREVIOUS');

  // Look for step indicators
  const stepIndicators = root.querySelectorAll(
    '[class*="step"], [class*="progress"], [data-step], [aria-current="step"]'
  );

  // Try to extract current step from page content
  let estimatedStep = 1;
  const textContent = root instanceof Document ? root.body?.textContent : root.textContent;
  const stepText = textContent?.match(/step\s*(\d+)\s*(of|\/)\s*\d+/i);
  if (stepText) {
    estimatedStep = parseInt(stepText[1], 10);
  }

  const isMultiPage = (hasNext && hasPrevious) || stepIndicators.length > 0 || hasPrevious;

  return { isMultiPage, estimatedStep };
}
