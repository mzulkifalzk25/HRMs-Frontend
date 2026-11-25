// App-wide constants.

export const APP_NAME = 'FormbaxHR'

/**
 * Organization timezone for every attendance/leave policy decision (D-050, D-028).
 * Always an IANA zone name: never hardcode "+05:00" (Pakistan observed DST in 2008–2009,
 * which matters for historical imports).
 */
export const APP_TIMEZONE = 'Asia/Karachi'

/**
 * Display formats (date-fns tokens). PROVISIONAL until Q-TECH-04 (language and date
 * format preferences) is answered; change them here only.
 */
export const DISPLAY_FORMATS = {
  date: 'd MMM yyyy', // 25 Nov 2026
  time: 'h:mm a', // 9:15 AM
  timeWithSeconds: 'h:mm:ss a', // 9:15:01 AM
  dateTime: 'd MMM yyyy, h:mm a', // 25 Nov 2026, 9:15 AM
} as const
