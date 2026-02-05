import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Prewrite',
    description: 'Scan job application forms and extract field data for API integration',
    permissions: ['activeTab', 'scripting', 'webNavigation'],
    host_permissions: [
      'https://*.greenhouse.io/*',
      'https://*.lever.co/*',
      'https://*.workday.com/*',
      'https://*.icims.com/*',
      'https://*.smartrecruiters.com/*',
      'https://*.ashbyhq.com/*',
      'https://*.google.com/*',
      'https://*.linkedin.com/*',
      'https://*.indeed.com/*',
    ],
  },
});
