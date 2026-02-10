/**
 * Job List Page Detector
 * Detects whether the current page is a job listings page (many jobs)
 * vs. a single job detail page.
 */

export interface JobListDetection {
  is_job_list_page: boolean;
  confidence: number; // 0-1
  estimated_job_count: number;
}

/**
 * Terms whose repeated appearance strongly indicates a job listing page
 */
const JOB_LISTING_INDICATORS = [
  'apply now',
  'apply',
  'view job',
  'view role',
  'view details',
  'learn more',
  'see job',
  'open position',
];

/**
 * URL path segments that indicate individual job links
 */
const JOB_LINK_PATTERNS = [
  '/job/',
  '/jobs/',
  '/careers/',
  '/position/',
  '/opening/',
  '/vacancy/',
  '/apply/',
  '/applications/jobs/',
];

/**
 * Keywords that strongly indicate a job DETAIL page (not a listing).
 * If these are found, the listing confidence is reduced.
 */
const JOB_DETAIL_KEYWORDS = [
  'responsibilities',
  'minimum qualifications',
  'preferred qualifications',
  'about the job',
  'about the role',
  'about this role',
  'what you will do',
  "what you'll do",
  'your role',
  'the role',
  'job description',
  'key responsibilities',
  'requirements',
  'nice to have',
  'what we offer',
  'benefits',
  'who you are',
  "we'd love to hear from you",
  'about you',
];

/**
 * Detects if the current page is a job listing page
 */
export function detectJobListPage(): JobListDetection {
  let score = 0;
  let estimatedJobs = 0;

  // 1. Count "Apply" / "Apply Now" type buttons/links
  const applyCount = countApplyElements();
  if (applyCount >= 3) {
    score += 0.3;
    estimatedJobs = Math.max(estimatedJobs, applyCount);
  }

  // 2. Count links pointing to individual job URLs
  const jobLinkCount = countJobLinks();
  if (jobLinkCount >= 3) {
    score += 0.3;
    estimatedJobs = Math.max(estimatedJobs, jobLinkCount);
  }

  // 3. Count repeated structural patterns (cards/rows with similar classes)
  const repeatedCardCount = countRepeatedJobCards();
  if (repeatedCardCount >= 3) {
    score += 0.2;
    estimatedJobs = Math.max(estimatedJobs, repeatedCardCount);
  }

  // 4. Check for pagination or "showing X results" text
  if (hasPaginationOrResultCount()) {
    score += 0.1;
  }

  // 5. Check for search/filter UI (strong listing page indicator)
  if (hasSearchOrFilter()) {
    score += 0.1;
  }

  // 6. COUNTER-SIGNAL: Check for job detail keywords
  // Pages like Google Careers show a list sidebar + detail panel.
  // If detail keywords are present, reduce listing confidence.
  // BUT if the same keyword repeats 3+ times, that's a STRONG listing signal
  // (multiple jobs each showing "Responsibilities", "Requirements", etc.)
  const { uniqueCount: detailKeywordCount, maxRepetitions } = countJobDetailKeywords();

  if (maxRepetitions >= 3) {
    // Same keyword appearing 3+ times = strong listing page signal
    // (e.g. "Responsibilities" appearing 10 times means 10 jobs)
    score += 0.35;
  } else if (detailKeywordCount >= 3) {
    // Multiple unique detail keywords, each appearing once = detail page
    score -= 0.4;
  } else if (detailKeywordCount >= 2) {
    score -= 0.3;
  } else if (detailKeywordCount >= 1) {
    score -= 0.15;
  }

  // Clamp score to 0-1
  const confidence = Math.max(0, Math.min(score, 1));

  return {
    is_job_list_page: confidence >= 0.4,
    confidence,
    estimated_job_count: estimatedJobs,
  };
}

/**
 * Count elements that look like "Apply" buttons/links
 */
function countApplyElements(): number {
  let count = 0;
  const allLinks = document.querySelectorAll('a, button');

  allLinks.forEach((el) => {
    const text = el.textContent?.trim().toLowerCase() || '';
    if (JOB_LISTING_INDICATORS.some((indicator) => text === indicator || text.startsWith(indicator))) {
      count++;
    }
  });

  return count;
}

/**
 * Count links that point to individual job detail URLs
 */
function countJobLinks(): number {
  const links = document.querySelectorAll('a[href]');
  const seen = new Set<string>();
  let count = 0;

  links.forEach((link) => {
    const href = link.getAttribute('href') || '';
    const lowerHref = href.toLowerCase();

    // Check if link matches job URL patterns
    const isJobLink = JOB_LINK_PATTERNS.some((pattern) => lowerHref.includes(pattern));

    if (isJobLink && !seen.has(href)) {
      seen.add(href);
      count++;
    }
  });

  return count;
}

/**
 * Count repeated "card" like elements that have similar structure
 * (job listing pages typically have many structurally identical cards)
 */
function countRepeatedJobCards(): number {
  // Look for common card/list-item patterns
  const cardSelectors = [
    '[class*="job-card"]',
    '[class*="job-listing"]',
    '[class*="job-item"]',
    '[class*="job-row"]',
    '[class*="position-card"]',
    '[class*="posting"]',
    '[class*="vacancy"]',
    '[class*="opening"]',
    '[class*="search-result"]',
    '[class*="result-card"]',
    'li[class*="job"]',
    'tr[class*="job"]',
    '[role="listitem"]',
  ];

  let maxCount = 0;

  for (const selector of cardSelectors) {
    try {
      const count = document.querySelectorAll(selector).length;
      if (count > maxCount) {
        maxCount = count;
      }
    } catch { /* ignore */ }
  }

  // Also look for repeated child elements with the same class name
  // under common container patterns
  if (maxCount < 3) {
    const containers = document.querySelectorAll('ul, ol, [role="list"], [class*="list"], [class*="results"]');
    containers.forEach((container) => {
      const children = container.children;
      if (children.length >= 3) {
        // Check if children share the same tag + class
        const firstClass = children[0]?.className || '';
        const firstTag = children[0]?.tagName || '';
        if (firstClass || firstTag) {
          let sameCount = 0;
          for (let i = 0; i < children.length; i++) {
            if (children[i].tagName === firstTag && children[i].className === firstClass) {
              sameCount++;
            }
          }
          if (sameCount > maxCount) {
            maxCount = sameCount;
          }
        }
      }
    });
  }

  return maxCount;
}

/**
 * Check for pagination elements or "showing X results" text
 */
function hasPaginationOrResultCount(): boolean {
  // Check for pagination
  const paginationSelectors = [
    '[class*="pagination"]',
    '[role="navigation"][aria-label*="page"]',
    '[class*="pager"]',
    'nav[aria-label*="Page"]',
  ];

  for (const selector of paginationSelectors) {
    try {
      if (document.querySelector(selector)) return true;
    } catch { /* ignore */ }
  }

  // Check for "showing X results" type text
  const body = document.body.textContent?.toLowerCase() || '';
  const resultPatterns = [
    /showing \d+ (?:of \d+ )?results/i,
    /\d+ jobs? found/i,
    /\d+ positions? (?:available|found|matching)/i,
    /\d+ openings?/i,
    /displaying \d+/i,
  ];

  return resultPatterns.some((pattern) => pattern.test(body));
}

/**
 * Check for search/filter UI elements
 */
function hasSearchOrFilter(): boolean {
  const filterSelectors = [
    '[class*="filter"]',
    '[class*="search-bar"]',
    '[class*="job-search"]',
    'input[placeholder*="search"]',
    'input[placeholder*="keyword"]',
    'select[class*="filter"]',
    '[class*="facet"]',
  ];

  let filterCount = 0;
  for (const selector of filterSelectors) {
    try {
      if (document.querySelector(selector)) filterCount++;
    } catch { /* ignore */ }
  }

  return filterCount >= 1;
}

/**
 * Count job detail keywords found on the page.
 * Returns the number of unique keywords found AND the max repetitions
 * of any single keyword (repeated keywords = listing page signal).
 */
function countJobDetailKeywords(): { uniqueCount: number; maxRepetitions: number } {
  // Count occurrences of each keyword across headers
  const keywordCounts = new Map<string, number>();

  const headers = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  headers.forEach((header) => {
    const text = header.textContent?.toLowerCase().trim() || '';
    for (const keyword of JOB_DETAIL_KEYWORDS) {
      if (text.includes(keyword)) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      }
    }
  });

  // Also scan body text for keywords not in headers (count once each)
  const bodyText = document.body.textContent?.toLowerCase() || '';
  for (const keyword of JOB_DETAIL_KEYWORDS) {
    if (!keywordCounts.has(keyword) && bodyText.includes(keyword)) {
      keywordCounts.set(keyword, 1);
    }
  }

  // Find the max repetitions of any single keyword
  let maxRepetitions = 0;
  for (const count of keywordCounts.values()) {
    if (count > maxRepetitions) {
      maxRepetitions = count;
    }
  }

  return {
    uniqueCount: keywordCounts.size,
    maxRepetitions,
  };
}
