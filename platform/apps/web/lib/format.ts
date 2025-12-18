/**
 * Re-export formatting utilities from shared package
 * Import from this file for convenience:
 *
 * @example
 * import { formatCurrency, formatDate, calculateNights } from '@/lib/format';
 *
 * // Currency
 * formatCurrency(12500) // "$125.00"
 * formatCurrency(12500, { showCents: false }) // "$125"
 * centsToDollars(12500) // 125
 * dollarsToCents(125) // 12500
 *
 * // Dates
 * formatDate('2024-12-25') // "Dec 25, 2024"
 * formatDate('2024-12-25', { includeWeekday: true }) // "Wed, Dec 25, 2024"
 * formatDateRange('2024-12-20', '2024-12-25') // "Dec 20 - 25, 2024"
 * calculateNights('2024-12-20', '2024-12-25') // 5
 */

export {
  // Currency
  formatCurrency,
  centsToDollars,
  dollarsToCents,
  formatCentsAsDecimal,
  parseDollarsToCents,
  formatCurrencyCompact,

  // Dates
  formatDate,
  formatDateRange,
  formatISODate,
  formatTime,
  parseDate,
  isValidDate,
  calculateNights,
  getRelativeTime,
  isPastDate,
  isToday,
  addDays,

  // Numbers
  formatNumber,
  formatPercentage,

  // Types
  type DateInput,
  type DateFormatOptions,
} from '@campreserv/shared';
