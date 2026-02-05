export default defineBackground(() => {
  console.log('[Prewrite] Background script loaded', { id: browser.runtime.id });

  // Handle extension icon click - open popup
  browser.action.onClicked.addListener(async (tab) => {
    if (tab.id) {
      console.log('[Prewrite] Extension clicked on tab:', tab.id);
    }
  });
});
