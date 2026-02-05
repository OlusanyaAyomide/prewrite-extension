import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Prewrite',
    description: 'Scan job application forms and extract field data for API integration',
    permissions: ['activeTab', 'scripting'],
  },
});



