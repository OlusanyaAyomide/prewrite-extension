/**
 * Extracts job-specific metadata from the page
 */

/**
 * Common selectors for job-related content
 */
const COMPANY_SELECTORS = [
  '.company-name',
  '.company',
  '[data-company]',
  '.employer-name',
  '.employer',
  '[class*="company"]',
  '[data-testid*="company"]',
];

const JOB_TITLE_SELECTORS = [
  '.job-title',
  '.position-title',
  '[data-job-title]',
  'h1[class*="title"]',
  '[class*="job-title"]',
  '[data-testid*="title"]',
];

const JOB_DESCRIPTION_SELECTORS = [
  '.job-description',
  '.description',
  '[data-job-description]',
  '[class*="job-description"]',
  '[class*="description"]',
];

/**
 * Extracts proposed company names from the page
 */
export function extractCompanyNames(): string[] {
  const companies = new Set<string>();

  // 1. Check OpenGraph meta tags
  const ogSiteName = document.querySelector('meta[property="og:site_name"]');
  if (ogSiteName?.getAttribute('content')) {
    companies.add(ogSiteName.getAttribute('content')!.trim());
  }

  // 2. Check common selectors
  for (const selector of COMPANY_SELECTORS) {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => {
      const text = el.textContent?.trim();
      if (text && text.length < 100) {
        companies.add(text);
      }
    });
  }

  // 3. Check page title for company name patterns
  const pageTitle = document.title;
  const titleMatch = pageTitle.match(/(?:at|@|with)\s+([^|–—-]+)/i);
  if (titleMatch) {
    companies.add(titleMatch[1].trim());
  }

  return Array.from(companies).slice(0, 5);
}

/**
 * Extracts proposed job titles from the page
 */
export function extractJobTitles(): string[] {
  const titles = new Set<string>();

  // 1. Check OpenGraph title
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle?.getAttribute('content')) {
    titles.add(ogTitle.getAttribute('content')!.trim());
  }

  // 2. Check common selectors
  for (const selector of JOB_TITLE_SELECTORS) {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => {
      const text = el.textContent?.trim();
      if (text && text.length < 150) {
        titles.add(text);
      }
    });
  }

  // 3. Check h1 elements
  const h1Elements = document.querySelectorAll('h1');
  h1Elements.forEach((h1) => {
    const text = h1.textContent?.trim();
    if (text && text.length < 150) {
      titles.add(text);
    }
  });

  // 4. Parse page title
  const pageTitle = document.title;
  const titleParts = pageTitle.split(/[|–—-]/);
  if (titleParts.length > 0) {
    const firstPart = titleParts[0].trim();
    if (firstPart.length < 100) {
      titles.add(firstPart);
    }
  }

  return Array.from(titles).slice(0, 5);
}

/**
 * Extracts proposed job descriptions from the page
 */
export function extractJobDescriptions(): string[] {
  const descriptions = new Set<string>();

  // 1. Check OpenGraph description
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription?.getAttribute('content')) {
    descriptions.add(ogDescription.getAttribute('content')!.trim());
  }

  // 2. Check meta description
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription?.getAttribute('content')) {
    descriptions.add(metaDescription.getAttribute('content')!.trim());
  }

  // 3. Check common selectors
  for (const selector of JOB_DESCRIPTION_SELECTORS) {
    const elements = document.querySelectorAll(selector);
    elements.forEach((el) => {
      const text = el.textContent?.trim();
      if (text && text.length > 50 && text.length < 2000) {
        descriptions.add(text.substring(0, 500) + (text.length > 500 ? '...' : ''));
      }
    });
  }

  return Array.from(descriptions).slice(0, 3);
}

/**
 * Extracts all job metadata from the page
 */
export function extractJobMetadata(): {
  companies: string[];
  titles: string[];
  descriptions: string[];
} {
  return {
    companies: extractCompanyNames(),
    titles: extractJobTitles(),
    descriptions: extractJobDescriptions(),
  };
}
