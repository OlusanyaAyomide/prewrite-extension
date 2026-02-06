/**
 * Job Portal URL Detector
 * Checks if current URL matches known job portal patterns
 */

/**
 * URL patterns that indicate a job portal/application page
 * Matches are case-insensitive
 */
const JOB_PORTAL_PATTERNS = [
  // URL path patterns
  '/careers',
  '/jobs',
  '/job/',
  '/apply',
  '/application',
  '/hiring',
  '/opportunities',
  '/openings',
  '/vacancies',
  '/positions',

  // Domain patterns
  'linkedin.com/jobs',
  'indeed.com',
  'glassdoor.com/job',
  'ziprecruiter.com',
  'monster.com',
  'careerbuilder.com',
  'greenhouse.io',
  'lever.co',
  'workday.com',
  'icims.com',
  'smartrecruiters.com',
  'ashbyhq.com',
  'turing.com',
  'angel.co/jobs',
  'wellfound.com',
  'dice.com',
  'stackoverflow.com/jobs',
  'hired.com',
  'triplebyte.com',
  'toptal.com',
  'upwork.com',
  'flexjobs.com',
  'remote.co',
  'weworkremotely.com',
  'remoteok.com',
  'jobvite.com',
  'breezy.hr',
  'recruitee.com',
  'bamboohr.com',
  'jazz.hr',
  'workable.com',
  'pinpointhq.com',
  'fountain.com',
  'recruitingbypaycor.com',
  'applicantstack.com',
  'taleo.net',
  'successfactors.com',
  'peoplehr.com',
  'myworkdayjobs.com',

  // Company career page patterns
  'google.com/about/careers',
  'amazon.jobs',
  'meta.com/careers',
  'microsoft.com/careers',
  'apple.com/careers',
  'netflix.jobs',
  'stripe.com/jobs',
  'airbnb.com/careers',
  'uber.com/careers',
  'lyft.com/careers',
  'twitter.com/careers',
  'openai.com/careers',
  'anthropic.com/careers',
  'salesforce.com/careers',
  'adobe.com/careers',
  'oracle.com/careers',
  'ibm.com/careers',
  'cisco.com/careers',
  'nvidia.com/careers',
];

/**
 * Keywords in URL that strongly indicate job applications
 */
const JOB_URL_KEYWORDS = [
  'career',
  'job',
  'jobs',
  'apply',
  'application',
  'hiring',
  'recruit',
  'talent',
  'opportunity',
  'opening',
  'vacancy',
  'position',
  'employment',
];

/**
 * Check if a URL matches job portal patterns
 */
export function isJobPortalUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();

  // Check against known patterns
  for (const pattern of JOB_PORTAL_PATTERNS) {
    if (lowerUrl.includes(pattern.toLowerCase())) {
      return true;
    }
  }

  // Check for keyword patterns in path
  try {
    const urlObj = new URL(url);
    const pathSegments = urlObj.pathname.toLowerCase().split('/');

    for (const segment of pathSegments) {
      for (const keyword of JOB_URL_KEYWORDS) {
        if (segment.includes(keyword)) {
          return true;
        }
      }
    }
  } catch {
    // Invalid URL, return false
    return false;
  }

  return false;
}

/**
 * Get the confidence level of job portal detection
 */
export function getJobPortalConfidence(url: string): 'high' | 'medium' | 'low' | 'none' {
  const lowerUrl = url.toLowerCase();

  // High confidence: Known job board domains
  const highConfidencePatterns = [
    'linkedin.com/jobs',
    'indeed.com',
    'greenhouse.io',
    'lever.co',
    'workday.com',
    'icims.com',
    'smartrecruiters.com',
    'ashbyhq.com',
  ];

  for (const pattern of highConfidencePatterns) {
    if (lowerUrl.includes(pattern)) {
      return 'high';
    }
  }

  // Medium confidence: Company career pages
  const mediumConfidencePatterns = [
    '/careers',
    '/jobs',
    '/apply',
    'amazon.jobs',
    'netflix.jobs',
  ];

  for (const pattern of mediumConfidencePatterns) {
    if (lowerUrl.includes(pattern)) {
      return 'medium';
    }
  }

  // Low confidence: Contains job-related keywords
  for (const keyword of JOB_URL_KEYWORDS) {
    if (lowerUrl.includes(keyword)) {
      return 'low';
    }
  }

  return 'none';
}
