/**
 * Flattened Lucide-style outline paths, 24×24 grid, drawn with a round-capped
 * stroke. Every icon is ONE `d` string (SVG subpaths) so <app-icon> needs a
 * single <path> and no HTML sanitizer. Circles are pre-flattened to arc pairs.
 */
export const ICON_PATHS = {
  // Navigation
  home: 'm3 10 9-7 9 7v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20z M9 21.5v-8h6v8',
  'clipboard-list':
    'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2 M9 2.5h6a1 1 0 0 1 1 1V5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z M9 12h6 M9 16.5h6',
  clock: 'M3.5 12a8.5 8.5 0 1 0 17 0 8.5 8.5 0 1 0-17 0 M12 7.5V12l3 2',
  'chart-column': 'M3 3v16a2 2 0 0 0 2 2h16 M8 17v-5 M13 17V8 M18 17v-7',
  user: 'M8.4 8a3.6 3.6 0 1 0 7.2 0 3.6 3.6 0 1 0-7.2 0 M5 20.5c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5',

  // Chevrons & arrows
  'chevron-left': 'm15 6-6 6 6 6',
  'chevron-right': 'm9 6 6 6-6 6',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-up': 'm6 15 6-6 6 6',
  'arrow-up': 'M12 19V5 m-6 6 6-6 6 6',
  'arrow-down': 'M12 5v14 m-6-6 6 6 6-6',
  swap: 'M8 3 4 7l4 4 M4 7h16 M16 21l4-4-4-4 M20 17H4',
  download: 'M12 15V3 m-4 7 4 4 4-4 M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',
  upload: 'M12 15V3 m-4 4 4-4 4 4 M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2',

  // Actions & status
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  check: 'm5 13 4 4L19 7',
  'check-circle': 'M3.5 12a8.5 8.5 0 1 0 17 0 8.5 8.5 0 1 0-17 0 m5-.1 2.6 2.7 5.2-5.6',
  x: 'M18 6 6 18 M6 6l12 12',
  trash:
    'M3 6h18 M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6 M19 6l-1 13.5a2 2 0 0 1-2 1.5H8a2 2 0 0 1-2-1.5L5 6 M10 10.5v6 M14 10.5v6',
  pencil: 'M17 3.5a2.6 2.6 0 1 1 3.7 3.7L8 20l-4.6 1L4.5 16.5z',
  copy: 'M9 8.5h9.5a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z M5.5 15.5h-1a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
  'dots-vertical': 'M12 5.5h.01 M12 12h.01 M12 18.5h.01',
  'rotate-ccw': 'M3 3.5V8h4.5 M4.6 6.4A8.5 8.5 0 1 1 3.5 12',
  search: 'M4 10.5a6.5 6.5 0 1 0 13 0 6.5 6.5 0 1 0-13 0 M15.2 15.2 21 21',
  'alert-triangle':
    'M12 4 2.8 19.5a1 1 0 0 0 .9 1.5h16.6a1 1 0 0 0 .9-1.5z M12 10v4 M12 17.5h.01',

  // Domain
  scale: 'M9.4 6a2.6 2.6 0 1 0 5.2 0 2.6 2.6 0 1 0-5.2 0 M7.2 9.4h9.6l1.8 10a1 1 0 0 1-1 1.2H6.4a1 1 0 0 1-1-1.2z',
  zap: 'M13 2 4.5 14H11l-1 8 8.5-12H12z',
  flame:
    'M12 3c2.5 3.5 5 6 5 9.5a5 5 0 0 1-10 0C7 9 9.5 6.5 12 3z M12 13.5c-.8.9-1.2 1.6-1.2 2.4a1.2 1.2 0 0 0 2.4 0c0-.8-.4-1.5-1.2-2.4z',
  timer: 'M4.5 13a7.5 7.5 0 1 0 15 0 7.5 7.5 0 1 0-15 0 M12 9.5V13l2.4 1.6 M10 2.5h4',
  image:
    'M4.5 4.5h15A1.5 1.5 0 0 1 21 6v12a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V6a1.5 1.5 0 0 1 1.5-1.5z M7.3 9.3a1.4 1.4 0 1 0 2.8 0 1.4 1.4 0 1 0-2.8 0 M21 15.5l-4.8-4.8-9.7 9.8',
  calendar:
    'M7 2.5V6 M17 2.5V6 M4.5 4.5h15A1.5 1.5 0 0 1 21 6v13a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19V6a1.5 1.5 0 0 1 1.5-1.5z M3 9.5h18',
  'book-open':
    'M12 6.5C10.5 5 8.5 4.5 6 4.5c-1.2 0-2.3.2-3 .5v14c.7-.3 1.8-.5 3-.5 2.5 0 4.5.5 6 2 1.5-1.5 3.5-2 6-2 1.2 0 2.3.2 3 .5v-14c-.7-.3-1.8-.5-3-.5-2.5 0-4.5.5-6 2z M12 6.5v14',

  // Session categories (custom glyphs, same grid & stroke)
  dumbbell: 'M8 12h8 M5.5 7.5v9 M18.5 7.5v9 M3 10v4 M21 10v4',
  'pull-up': 'M4 4h16 M8 4c0 4.2 1.6 6.5 4 6.5s4-2.3 4-6.5 M9.8 14.5a2.2 2.2 0 1 0 4.4 0 2.2 2.2 0 1 0-4.4 0 M12 16.7v3',
  squat:
    'M10 4.2a2 2 0 1 0 4 0 2 2 0 1 0-4 0 M4 8.2h16 M12 10.2v4.6 M12 14.8l-3.4 5 M12 14.8l3.4 5',
  'abs-grid':
    'M8.3 4.5h3.2v3.6H8.3z M12.7 4.5h3.2v3.6h-3.2z M8.3 10.2h3.2v3.6H8.3z M12.7 10.2h3.2v3.6h-3.2z M8.3 15.9h3.2v3.6H8.3z M12.7 15.9h3.2v3.6h-3.2z',
} as const;

export type IconName = keyof typeof ICON_PATHS;
