/**
 * Shared formatting utilities for dates and currency
 * Used across web and API for consistent formatting
 */

// ================================
// Currency Utilities
// ================================

/**
 * Format cents as a currency string (e.g., 1250 -> "$12.50")
 * @param cents - Amount in cents (integer)
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export function formatCurrency(
  cents: number | null | undefined,
  options: {
    currency?: string;
    locale?: string;
    showCents?: boolean;
    showSign?: boolean;
  } = {}
): string {
  const {
    currency = 'USD',
    locale = 'en-US',
    showCents = true,
    showSign = false
  } = options;

  if (cents === null || cents === undefined) {
    return showCents ? '$0.00' : '$0';
  }

  const dollars = cents / 100;
  const sign = showSign && cents > 0 ? '+' : '';

  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: showCents ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(Math.abs(dollars));

  // Handle negative amounts
  if (cents < 0) {
    return `-${formatted}`;
  }

  return `${sign}${formatted}`;
}

/**
 * Convert cents to dollars (e.g., 1250 -> 12.50)
 * @param cents - Amount in cents
 * @returns Amount in dollars
 */
export function centsToDollars(cents: number | null | undefined): number {
  if (cents === null || cents === undefined) return 0;
  return cents / 100;
}

/**
 * Convert dollars to cents (e.g., 12.50 -> 1250)
 * @param dollars - Amount in dollars
 * @returns Amount in cents (rounded to nearest integer)
 */
export function dollarsToCents(dollars: number | null | undefined): number {
  if (dollars === null || dollars === undefined) return 0;
  return Math.round(dollars * 100);
}

/**
 * Format cents for display without currency symbol (e.g., 1250 -> "12.50")
 * Useful for input fields
 */
export function formatCentsAsDecimal(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '0.00';
  return (cents / 100).toFixed(2);
}

/**
 * Parse a dollar string to cents (e.g., "12.50" -> 1250)
 * Handles common input formats
 */
export function parseDollarsToCents(value: string): number {
  if (!value) return 0;
  // Remove currency symbols and whitespace
  const cleaned = value.replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

// ================================
// Date Utilities
// ================================

export type DateInput = Date | string | number | null | undefined;

export interface DateFormatOptions {
  /** Include weekday (e.g., "Mon") */
  includeWeekday?: boolean;
  /** Include year */
  includeYear?: boolean;
  /** Include time */
  includeTime?: boolean;
  /** Use short month format (e.g., "Dec" vs "December") */
  shortMonth?: boolean;
  /** Locale for formatting */
  locale?: string;
}

/**
 * Parse various date inputs to a Date object
 * @param date - Date input (string, Date, or timestamp)
 * @returns Date object or null if invalid
 */
export function parseDate(date: DateInput): Date | null {
  if (!date) return null;

  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : date;
  }

  if (typeof date === 'number') {
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof date === 'string') {
    // Handle ISO date strings and common formats
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Check if a date input is valid
 */
export function isValidDate(date: DateInput): boolean {
  return parseDate(date) !== null;
}

/**
 * Format a date for display
 * @param date - Date to format
 * @param options - Formatting options
 * @returns Formatted date string
 *
 * @example
 * formatDate('2024-12-25') // "Dec 25, 2024"
 * formatDate('2024-12-25', { includeWeekday: true }) // "Wed, Dec 25, 2024"
 * formatDate('2024-12-25', { shortMonth: false }) // "December 25, 2024"
 */
export function formatDate(date: DateInput, options: DateFormatOptions = {}): string {
  const parsed = parseDate(date);
  if (!parsed) return '';

  const {
    includeWeekday = false,
    includeYear = true,
    includeTime = false,
    shortMonth = true,
    locale = 'en-US',
  } = options;

  const formatOptions: Intl.DateTimeFormatOptions = {
    month: shortMonth ? 'short' : 'long',
    day: 'numeric',
  };

  if (includeWeekday) {
    formatOptions.weekday = 'short';
  }

  if (includeYear) {
    formatOptions.year = 'numeric';
  }

  if (includeTime) {
    formatOptions.hour = 'numeric';
    formatOptions.minute = '2-digit';
  }

  return parsed.toLocaleDateString(locale, formatOptions);
}

/**
 * Format a date range for display
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Formatted date range string
 *
 * @example
 * formatDateRange('2024-12-20', '2024-12-25') // "Dec 20 - 25, 2024"
 * formatDateRange('2024-12-20', '2025-01-05') // "Dec 20, 2024 - Jan 5, 2025"
 */
export function formatDateRange(startDate: DateInput, endDate: DateInput): string {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (!start || !end) return '';

  const sameYear = start.getFullYear() === end.getFullYear();
  const sameMonth = sameYear && start.getMonth() === end.getMonth();

  if (sameMonth) {
    // "Dec 20 - 25, 2024"
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.getDate()}, ${end.getFullYear()}`;
  }

  if (sameYear) {
    // "Nov 28 - Dec 5, 2024"
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${end.getFullYear()}`;
  }

  // "Dec 28, 2024 - Jan 5, 2025"
  return `${formatDate(start)} - ${formatDate(end)}`;
}

/**
 * Format date as ISO date string (YYYY-MM-DD)
 * Useful for API calls and form values
 */
export function formatISODate(date: DateInput): string {
  const parsed = parseDate(date);
  if (!parsed) return '';
  return parsed.toISOString().split('T')[0];
}

/**
 * Calculate number of nights between two dates
 * @param arrivalDate - Check-in date
 * @param departureDate - Check-out date
 * @returns Number of nights
 */
export function calculateNights(arrivalDate: DateInput, departureDate: DateInput): number {
  const arrival = parseDate(arrivalDate);
  const departure = parseDate(departureDate);

  if (!arrival || !departure) return 0;

  const diffTime = departure.getTime() - arrival.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(0, diffDays);
}

/**
 * Get relative time description (e.g., "in 3 days", "2 days ago")
 * @param date - Target date
 * @param referenceDate - Reference date (defaults to now)
 */
export function getRelativeTime(date: DateInput, referenceDate: DateInput = new Date()): string {
  const target = parseDate(date);
  const reference = parseDate(referenceDate);

  if (!target || !reference) return '';

  const diffMs = target.getTime() - reference.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  if (diffDays > 0) return `in ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

/**
 * Format time from a date or time string
 * @param date - Date or time string
 * @param use24Hour - Use 24-hour format
 */
export function formatTime(date: DateInput, use24Hour = false): string {
  const parsed = parseDate(date);
  if (!parsed) return '';

  return parsed.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: !use24Hour,
  });
}

/**
 * Check if a date is in the past
 */
export function isPastDate(date: DateInput): boolean {
  const parsed = parseDate(date);
  if (!parsed) return false;
  return parsed < new Date();
}

/**
 * Check if a date is today
 */
export function isToday(date: DateInput): boolean {
  const parsed = parseDate(date);
  if (!parsed) return false;

  const today = new Date();
  return (
    parsed.getDate() === today.getDate() &&
    parsed.getMonth() === today.getMonth() &&
    parsed.getFullYear() === today.getFullYear()
  );
}

/**
 * Add days to a date
 */
export function addDays(date: DateInput, days: number): Date | null {
  const parsed = parseDate(date);
  if (!parsed) return null;

  const result = new Date(parsed);
  result.setDate(result.getDate() + days);
  return result;
}

// ================================
// Compact Display Utilities
// ================================

/**
 * Format currency in compact form for limited space
 * e.g., 150000 -> "$1.5K", 1500000 -> "$15K"
 */
export function formatCurrencyCompact(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '$0';

  const dollars = Math.abs(cents / 100);
  const sign = cents < 0 ? '-' : '';

  if (dollars >= 1000000) {
    return `${sign}$${(dollars / 1000000).toFixed(1)}M`;
  }
  if (dollars >= 1000) {
    return `${sign}$${(dollars / 1000).toFixed(1)}K`;
  }
  return `${sign}$${dollars.toFixed(0)}`;
}

/**
 * Format number with commas (e.g., 1234567 -> "1,234,567")
 */
export function formatNumber(value: number | null | undefined, locale = 'en-US'): string {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat(locale).format(value);
}

/**
 * Format percentage (e.g., 0.156 -> "15.6%")
 */
export function formatPercentage(
  value: number | null | undefined,
  decimals = 1
): string {
  if (value === null || value === undefined) return '0%';
  return `${(value * 100).toFixed(decimals)}%`;
}
