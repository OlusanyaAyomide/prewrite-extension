import type { GeneratedItem } from '@/types/autofill';

const GENERATED_KEY = 'prewrite_generated';
const MAX_ITEMS = 20;

/**
 * Get generated items from extension storage (async)
 */
async function getItems(): Promise<GeneratedItem[]> {
  try {
    const result = await browser.storage.local.get(GENERATED_KEY);
    return (result[GENERATED_KEY] as GeneratedItem[]) || [];
  } catch (error) {
    console.error('[Prewrite] Failed to get items:', error);
    return [];
  }
}

/**
 * Save generated items to extension storage (async)
 */
async function saveItems(items: GeneratedItem[]): Promise<void> {
  try {
    await browser.storage.local.set({ [GENERATED_KEY]: items });
  } catch (error) {
    console.error('[Prewrite] Failed to save items:', error);
  }
}

/**
 * Add generated content item
 */
export async function addGeneratedItem(
  item: Omit<GeneratedItem, 'id' | 'createdAt'>
): Promise<GeneratedItem> {
  const items = await getItems();

  const newItem: GeneratedItem = {
    ...item,
    id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };

  items.unshift(newItem);

  // Keep only most recent items
  const trimmed = items.slice(0, MAX_ITEMS);
  await saveItems(trimmed);

  return newItem;
}

/**
 * Get recent generated items
 */
export async function getRecentGenerated(limit: number = 10): Promise<GeneratedItem[]> {
  const items = await getItems();
  return items.slice(0, limit);
}

/**
 * Get all generated items
 */
export async function getAllGenerated(): Promise<GeneratedItem[]> {
  return getItems();
}

/**
 * Delete generated item by ID
 */
export async function deleteGeneratedItem(id: string): Promise<boolean> {
  const items = await getItems();
  const filtered = items.filter((i) => i.id !== id);

  if (filtered.length !== items.length) {
    await saveItems(filtered);
    return true;
  }
  return false;
}

/**
 * Trigger download for a generated item
 * This runs in content script/client side only? 
 * If background script calls this, document is not available.
 * But background script doesn't call this usually.
 */
export function downloadGeneratedItem(item: GeneratedItem): void {
  // Only works in context where document exists (content script, popup)
  if (typeof document === 'undefined') {
    console.warn('[Prewrite] downloadGeneratedItem called outside of document context');
    return;
  }

  const link = document.createElement('a');
  link.href = item.url;
  link.download = `${item.type}_${item.company}_${item.jobTitle}.pdf`.replace(/\s+/g, '_');
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
