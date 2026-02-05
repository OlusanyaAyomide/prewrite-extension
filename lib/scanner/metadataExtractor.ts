/**
 * Extracts job-specific metadata from the page
 * Enhanced with sibling-traversal strategy and phrase pattern matching
 * for sites like Turing that lack proper labels
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
  '[class*="employer"]',
  '[itemprop="hiringOrganization"]',
];

const JOB_TITLE_SELECTORS = [
  '.job-title',
  '.position-title',
  '[data-job-title]',
  'h1[class*="title"]',
  '[class*="job-title"]',
  '[data-testid*="title"]',
  '[itemprop="title"]',
  '[class*="gc-card__title"]',
];

const JOB_DESCRIPTION_SELECTORS = [
  '.job-description',
  '.description',
  '[data-job-description]',
  '[class*="job-description"]',
  '[class*="description"]',
  '[itemprop="description"]',
  '[class*="gc-card__content"]',
];

/**
 * Keywords that indicate a section HEADER contains job requirements
 */
const DESCRIPTION_KEYWORDS = [
  'qualifications',
  'requirements',
  'responsibilities',
  'about the job',
  'about the role',
  'what you will do',
  "what you'll do",
  'minimum qualifications',
  'preferred qualifications',
  'nice to have',
  'skills',
  'experience',
  'education',
  'benefits',
  'what we offer',
  'your role',
  'the role',
  'job description',
];

/**
 * EXTENSIVE PHRASE PATTERNS for text-based extraction
 * These patterns are searched case-insensitively within page text
 * When found, we extract the full containing HTML element's text
 */
const JOB_DESCRIPTION_PHRASES = [
  // Seeking/Looking patterns
  'we are seeking',
  'we are looking for',
  "we're looking for",
  "we're seeking",
  'we seek',
  'looking for a',
  'seeking a',
  'searching for',
  'in search of',
  'hunting for',

  // Developer/Talent patterns
  'talented developers',
  'talented engineers',
  'talented professionals',
  'talented individuals',
  'exceptional developers',
  'exceptional engineers',
  'skilled developers',
  'skilled engineers',
  'experienced developers',
  'experienced engineers',
  'passionate developers',
  'passionate engineers',
  'top-tier developers',
  'world-class engineers',

  // Opportunity patterns
  'exciting opportunity',
  'unique opportunity',
  'great opportunity',
  'amazing opportunity',
  'incredible opportunity',
  'join our team',
  'join us',
  'become part of',
  'be part of',

  // Role description patterns
  'in this role',
  'for this role',
  'as a',
  'you will be',
  "you'll be",
  'you will work',
  "you'll work",
  'you will help',
  "you'll help",
  'you will build',
  "you'll build",
  'you will design',
  "you'll design",
  'you will develop',
  "you'll develop",
  'you will lead',
  "you'll lead",
  'you will collaborate',
  "you'll collaborate",

  // Ideal candidate patterns
  'ideal candidate',
  'successful candidate',
  'right candidate',
  'perfect candidate',
  'you should have',
  'you must have',
  'candidates should',
  'candidates must',
  'applicants should',
  'applicants must',

  // Experience patterns
  'years of experience',
  'years experience',
  'experience with',
  'experience in',
  'proficiency in',
  'proficient in',
  'expertise in',
  'strong background',
  'solid understanding',
  'deep understanding',
  'working knowledge',
  'hands-on experience',

  // Technical patterns
  'tech stack',
  'technology stack',
  'our stack',
  'core technologies',
  'key technologies',
  'required skills',
  'technical skills',
  'must-have skills',
  'nice-to-have skills',

  // About the company patterns
  'about us',
  'who we are',
  'our company',
  'our mission',
  'our vision',
  'we are a',
  "we're a",
  'founded in',
  'established in',
  'headquartered in',
  'based in',

  // Compensation/Benefits patterns
  'competitive salary',
  'competitive compensation',
  'comprehensive benefits',
  'health insurance',
  'stock options',
  'equity',
  'remote work',
  'work from home',
  'flexible hours',
  'flexible schedule',
  'unlimited pto',
  'paid time off',

  // Team/Culture patterns
  'our team',
  'our culture',
  'team environment',
  'collaborative environment',
  'fast-paced environment',
  'dynamic environment',
  'inclusive environment',
  'diverse team',

  // Application patterns
  'how to apply',
  'to apply',
  'apply now',
  'submit your',
  'send your resume',
  'send your cv',

  // Responsibility indicators
  'responsibilities include',
  'duties include',
  'you will be responsible',
  "you'll be responsible",
  'key responsibilities',
  'primary responsibilities',
  'day-to-day',
  'on a daily basis',

  // Requirement indicators
  'must have',
  'should have',
  'required:',
  'requirements:',
  'minimum requirements',
  'basic requirements',
  'essential requirements',
  'mandatory skills',

  // Nice to have indicators
  'nice to have',
  'bonus points',
  'plus if you',
  'preferred but not required',
  "it's a plus",
  'would be a plus',
  'is a plus',
  'advantageous',
  'desirable',

  // Work arrangement patterns
  'fully remote',
  'hybrid role',
  'on-site',
  'office-based',
  'location:',
  'work location',
];

/**
 * Phrase patterns for extracting COMPANY NAMES
 */
const COMPANY_PHRASES = [
  'at ',  // "Work at Google"
  'join ',  // "Join our team at Meta"
  'company:',
  'employer:',
  'hiring company',
  'hiring organization',
  'client:',
  'working with',
  'partner with',
];

/**
 * Phrase patterns for extracting JOB TITLES
 */
const JOB_TITLE_PHRASES = [
  'position:',
  'role:',
  'job title:',
  'title:',
  'hiring for',
  'opening for',
  'vacancy:',
  'we are hiring',
  "we're hiring",
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

  // 2. Check structured data (JSON-LD)
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  jsonLdScripts.forEach((script) => {
    try {
      const data = JSON.parse(script.textContent || '{}');
      if (data.hiringOrganization?.name) {
        companies.add(data.hiringOrganization.name);
      }
      if (data.employer?.name) {
        companies.add(data.employer.name);
      }
    } catch { /* ignore parsing errors */ }
  });

  // 3. Check common selectors
  for (const selector of COMPANY_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        const text = el.textContent?.trim();
        if (text && text.length < 100 && text.length > 1) {
          companies.add(text);
        }
      });
    } catch { /* ignore selector errors */ }
  }

  // 4. PHRASE-BASED EXTRACTION
  const phraseMatches = extractByPhrasePatterns(COMPANY_PHRASES, 50);
  phraseMatches.forEach((match) => companies.add(match));

  // 5. Check page title for company name patterns
  const pageTitle = document.title;
  const titleMatch = pageTitle.match(/(?:at|@|with|-)\s+([^|–—-]+?)(?:\s*[-|]|$)/i);
  if (titleMatch) {
    companies.add(titleMatch[1].trim());
  }

  return Array.from(companies).filter(Boolean).slice(0, 5);
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

  // 2. Check structured data (JSON-LD)
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  jsonLdScripts.forEach((script) => {
    try {
      const data = JSON.parse(script.textContent || '{}');
      if (data.title) {
        titles.add(data.title);
      }
      if (data.name && data['@type'] === 'JobPosting') {
        titles.add(data.name);
      }
    } catch { /* ignore parsing errors */ }
  });

  // 3. Check common selectors
  for (const selector of JOB_TITLE_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        const text = el.textContent?.trim();
        if (text && text.length < 150 && text.length > 2) {
          titles.add(text);
        }
      });
    } catch { /* ignore selector errors */ }
  }

  // 4. Check h1 elements
  const h1Elements = document.querySelectorAll('h1');
  h1Elements.forEach((h1) => {
    const text = h1.textContent?.trim();
    if (text && text.length < 150 && text.length > 2) {
      titles.add(text);
    }
  });

  // 5. PHRASE-BASED EXTRACTION
  const phraseMatches = extractByPhrasePatterns(JOB_TITLE_PHRASES, 100);
  phraseMatches.forEach((match) => titles.add(match));

  // 6. Parse page title
  const pageTitle = document.title;
  const titleParts = pageTitle.split(/[|–—-]/);
  if (titleParts.length > 0) {
    const firstPart = titleParts[0].trim();
    if (firstPart.length < 100 && firstPart.length > 2) {
      titles.add(firstPart);
    }
  }

  return Array.from(titles).filter(Boolean).slice(0, 5);
}

/**
 * Extracts proposed job descriptions from the page
 * Uses multiple strategies: JSON-LD, meta tags, headers, selectors, and PHRASE PATTERNS
 */
export function extractJobDescriptions(): string[] {
  const descriptions: string[] = [];
  const seen = new Set<string>();

  // 1. Check structured data (JSON-LD) first
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  jsonLdScripts.forEach((script) => {
    try {
      const data = JSON.parse(script.textContent || '{}');
      if (data.description) {
        const desc = cleanDescription(data.description);
        if (desc && !seen.has(desc)) {
          seen.add(desc);
          descriptions.push(desc);
        }
      }
    } catch { /* ignore parsing errors */ }
  });

  // 2. Check OpenGraph and meta descriptions
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription?.getAttribute('content')) {
    const desc = ogDescription.getAttribute('content')!.trim();
    if (!seen.has(desc)) {
      seen.add(desc);
      descriptions.push(desc);
    }
  }

  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription?.getAttribute('content')) {
    const desc = metaDescription.getAttribute('content')!.trim();
    if (!seen.has(desc)) {
      seen.add(desc);
      descriptions.push(desc);
    }
  }

  // 3. SIBLING-TRAVERSAL STRATEGY: Find headers with keywords
  const headers = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headers.forEach((header) => {
    const headerText = header.textContent?.toLowerCase().trim() || '';

    const matchesKeyword = DESCRIPTION_KEYWORDS.some((keyword) =>
      headerText.includes(keyword)
    );

    if (matchesKeyword) {
      const content = extractSiblingContent(header as HTMLElement);
      if (content && content.length > 20) {
        const sectionTitle = header.textContent?.trim() || '';
        const fullContent = sectionTitle ? `**${sectionTitle}**\n${content}` : content;

        if (!seen.has(content)) {
          seen.add(content);
          descriptions.push(fullContent);
        }
      }
    }
  });

  // 4. PHRASE-BASED EXTRACTION: Search for key phrases in text content
  const phraseMatches = extractDescriptionsByPhrasePatterns();
  phraseMatches.forEach((match) => {
    const key = match.substring(0, 100);
    if (!seen.has(key)) {
      seen.add(key);
      descriptions.push(match);
    }
  });

  // 5. Check common selectors as fallback
  for (const selector of JOB_DESCRIPTION_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        const text = el.textContent?.trim();
        if (text && text.length > 50 && text.length < 3000) {
          const cleaned = cleanDescription(text);
          if (!seen.has(cleaned.substring(0, 100))) {
            seen.add(cleaned.substring(0, 100));
            descriptions.push(cleaned.length > 800 ? cleaned.substring(0, 800) + '...' : cleaned);
          }
        }
      });
    } catch { /* ignore selector errors */ }
  }

  return descriptions.slice(0, 8);
}

/**
 * PHRASE-BASED EXTRACTION for job descriptions
 * Searches for key phrases and extracts the containing element's full text
 */
function extractDescriptionsByPhrasePatterns(): string[] {
  const results: string[] = [];
  const seenElements = new Set<Element>();

  // Get all text-containing elements
  const textElements = document.querySelectorAll('p, div, span, li, article, section');

  for (const element of textElements) {
    // Skip if we've already processed this element
    if (seenElements.has(element)) continue;

    const text = element.textContent?.toLowerCase() || '';

    // Check if any phrase pattern matches
    for (const phrase of JOB_DESCRIPTION_PHRASES) {
      if (text.includes(phrase.toLowerCase())) {
        // Find the best container element (go up to find a meaningful block)
        const container = findBestContainer(element as HTMLElement);

        if (container && !seenElements.has(container)) {
          seenElements.add(container);

          const containerText = container.textContent?.trim() || '';

          // Only include if it's substantial content
          if (containerText.length > 50 && containerText.length < 2000) {
            results.push(containerText);
          }
        }
        break; // Found a match, move to next element
      }
    }
  }

  return results;
}

/**
 * Find the best containing element for extracted text
 * Goes up the DOM to find a meaningful block-level container
 */
function findBestContainer(element: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element;
  const blockTags = ['p', 'div', 'article', 'section', 'li', 'blockquote'];

  // If current element is already a good container, use it
  if (blockTags.includes(current.tagName.toLowerCase())) {
    const text = current.textContent?.trim() || '';
    if (text.length > 50 && text.length < 2000) {
      return current;
    }
  }

  // Otherwise, traverse up to find a better container
  let depth = 0;
  const maxDepth = 5;

  while (current && depth < maxDepth) {
    const parent: HTMLElement | null = current.parentElement;
    if (!parent) break;

    const parentTag = parent.tagName.toLowerCase();
    const parentText = parent.textContent?.trim() || '';

    // Stop if we hit a very large container (like body or main content area)
    if (parentText.length > 5000) {
      return current;
    }

    // Prefer block-level elements with reasonable size
    if (blockTags.includes(parentTag) && parentText.length > 50 && parentText.length < 2000) {
      return parent;
    }

    current = parent;
    depth++;
  }

  return element;
}

/**
 * Generic phrase pattern extraction for shorter content (company, title)
 */
function extractByPhrasePatterns(phrases: string[], maxLength: number): string[] {
  const results: string[] = [];

  const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, li');

  for (const element of textElements) {
    const text = element.textContent?.toLowerCase() || '';

    for (const phrase of phrases) {
      const phraseIndex = text.indexOf(phrase.toLowerCase());
      if (phraseIndex !== -1) {
        // Extract the text after the phrase
        const afterPhrase = element.textContent!.substring(phraseIndex + phrase.length).trim();
        const extracted = afterPhrase.split(/[.\n,;]/)[0].trim();

        if (extracted && extracted.length > 2 && extracted.length < maxLength) {
          results.push(extracted);
        }
        break;
      }
    }
  }

  return results.slice(0, 3);
}

/**
 * Extract content from sibling elements after a header
 */
function extractSiblingContent(header: HTMLElement): string {
  const contentParts: string[] = [];
  let sibling = header.nextElementSibling;
  let maxSiblings = 5;

  while (sibling && maxSiblings > 0) {
    const tagName = sibling.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tagName)) {
      break;
    }

    if (tagName === 'ul' || tagName === 'ol') {
      const items = sibling.querySelectorAll('li');
      items.forEach((item) => {
        const text = item.textContent?.trim();
        if (text) {
          contentParts.push(`• ${text}`);
        }
      });
    } else if (tagName === 'p' || tagName === 'div') {
      const text = sibling.textContent?.trim();
      if (text && text.length > 10) {
        contentParts.push(text);
      }
    } else if (sibling.querySelector('ul, ol, p')) {
      const lists = sibling.querySelectorAll('ul, ol');
      lists.forEach((list) => {
        const items = list.querySelectorAll('li');
        items.forEach((item) => {
          const text = item.textContent?.trim();
          if (text) {
            contentParts.push(`• ${text}`);
          }
        });
      });
    }

    sibling = sibling.nextElementSibling;
    maxSiblings--;
  }

  return contentParts.join('\n');
}

/**
 * Clean up description text
 */
function cleanDescription(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
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
