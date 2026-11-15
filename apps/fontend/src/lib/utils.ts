/**
 * Formatting and display utilities
 */

/**
 * Formats a numeric or string monetary value as a USD currency string.
 *
 * @param amount - Numeric value or numeric string to format
 * @returns Localized currency string (e.g., `$1,234.50`)
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num || 0);
}

/**
 * Formats an ISO date string or `Date` instance into `vi-VN` date-time format.
 *
 * @param dateStr - ISO date string or `Date` object
 * @returns Formatted date and time string
 */
export function formatDate(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
