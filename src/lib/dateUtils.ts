/**
 * Date utilities for handling timezone conversions and formatting
 */

/**
 * Formats a date string with proper timezone conversion
 * @param dateString - The date string from the database (should be in UTC)
 * @param includeTime - Whether to include time in the output
 * @returns Formatted date string in user's local timezone
 */
export function formatDate(dateString: string, includeTime: boolean = true): string {
  // Ensure we're parsing the date correctly - handle various formats
  let date: Date;
  
  // If the string contains 'T' and ends with timezone info or 'Z', it's ISO format
  if (dateString.includes('T') && (dateString.endsWith('Z') || dateString.includes('+') || dateString.match(/T\d{2}:\d{2}:\d{2}$/))) {
    date = new Date(dateString);
  } else {
    // For PostgreSQL timestamp format like '2025-09-01 18:57:00+00'
    // Convert to ISO format for proper parsing
    const isoString = dateString.replace(' ', 'T').replace('+00', 'Z');
    date = new Date(isoString);
  }
  
  if (includeTime) {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  } else {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

/**
 * Calculates time remaining until end date in a human-readable format
 * @param endDate - The end date string
 * @returns Time remaining as string (e.g., "2d 5h 30m" or "Ended")
 */
export function getTimeRemaining(endDate: string): string {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - now.getTime();
  
  if (diffTime <= 0) return 'Ended';
  
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffTime % (1000 * 60 * 60)) / (1000 * 60));
  
  return `${days}d ${hours}h ${minutes}m`;
}

/**
 * Calculates time remaining in days (simplified version for card display)
 * @param endDate - The end date string  
 * @returns Time remaining as string (e.g., "5 days", "1 day", "Ended")
 */
export function getTimeRemainingDays(endDate: string): string {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return 'Ended';
  if (diffDays === 1) return '1 day';
  return `${diffDays} days`;
}

/**
 * Checks if a raffle is still active (not ended)
 * @param endDate - The end date string
 * @returns true if raffle is active, false if ended
 */
export function isRaffleActive(endDate: string): boolean {
  return new Date() < new Date(endDate);
}

/**
 * Converts a UTC datetime string to local datetime string for datetime-local input
 * @param utcDateString - The UTC date string from database
 * @returns Local datetime string in format "YYYY-MM-DDTHH:MM"
 */
export function utcToLocalDateTimeInput(utcDateString: string): string {
  const date = new Date(utcDateString);
  // Get the local datetime in ISO format and remove seconds/milliseconds
  return date.toISOString().slice(0, 16);
}

/**
 * Converts a local datetime-local input value to UTC ISO string
 * @param localDateTimeValue - The value from datetime-local input
 * @returns UTC ISO string for database storage
 */
export function localDateTimeInputToUTC(localDateTimeValue: string): string {
  // datetime-local value is like "2025-09-01T18:57"
  // When we create a Date from this, JS treats it as local time
  const localDate = new Date(localDateTimeValue);
  return localDate.toISOString();
}