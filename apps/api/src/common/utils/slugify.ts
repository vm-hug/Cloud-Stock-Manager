/**
 * Generates a clean URL slug from a name, supporting Vietnamese diacritics removal.
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric characters
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphen
    .replace(/-+/g, '-'); // Collapse multiple hyphens
}
