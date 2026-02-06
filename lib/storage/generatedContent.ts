import type { GeneratedItem } from '@/types/autofill';

const GENERATED_KEY = 'prewrite_generated';
const MAX_ITEMS = 20;

/**
 * Get generated items from localStorage
 */
function getItems(): GeneratedItem[] {
  try {
    const data = localStorage.getItem(GENERATED_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

/**
 * Save generated items to localStorage
 */
function saveItems(items: GeneratedItem[]): void {
  localStorage.setItem(GENERATED_KEY, JSON.stringify(items));
}

/**
 * Add generated content item
 */
export function addGeneratedItem(
  item: Omit<GeneratedItem, 'id' | 'createdAt'>
): GeneratedItem {
  const items = getItems();

  const newItem: GeneratedItem = {
    ...item,
    id: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };

  items.unshift(newItem);

  // Keep only most recent items
  const trimmed = items.slice(0, MAX_ITEMS);
  saveItems(trimmed);

  return newItem;
}

/**
 * Get recent generated items
 */
export function getRecentGenerated(limit: number = 10): GeneratedItem[] {
  const items = getItems();
  return items.slice(0, limit);
}

/**
 * Get all generated items
 */
export function getAllGenerated(): GeneratedItem[] {
  return getItems();
}

/**
 * Delete generated item by ID
 */
export function deleteGeneratedItem(id: string): boolean {
  const items = getItems();
  const filtered = items.filter((i) => i.id !== id);

  if (filtered.length !== items.length) {
    saveItems(filtered);
    return true;
  }
  return false;
}

/**
 * Trigger download for a generated item
 */
export function downloadGeneratedItem(item: GeneratedItem): void {
  const link = document.createElement('a');
  link.href = item.url;
  link.download = `${item.type}_${item.company}_${item.jobTitle}.pdf`.replace(/\s+/g, '_');
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
