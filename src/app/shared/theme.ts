import { IconName } from './components/icon-paths';

/**
 * Single point of contact with the design tokens for everything programmatic.
 * The tokens themselves live in src/styles.css (@theme static); this module
 * maps session categories to classes, icons and runtime color values, and is
 * the only place allowed to know those names.
 *
 * RULE: class strings are ALWAYS complete literals — Tailwind's scanner reads
 * .ts files but cannot see concatenated class names ('bg-cat-' + x is never
 * generated). Add new combinations as new literals.
 */

/** The four built-in day types; anything else (additional/routine/custom) maps to `extra`. */
export type SessionCategory = 'push' | 'pull' | 'legs' | 'abs';

/** Small pill: exercise lists, day badges */
export function categoryBadgeClass(category: string): string {
  switch (category) {
    case 'push': return 'bg-cat-push/15 text-cat-push';
    case 'pull': return 'bg-cat-pull/15 text-cat-pull';
    case 'legs': return 'bg-cat-legs/15 text-cat-legs';
    case 'abs':  return 'bg-cat-abs/15 text-cat-abs';
    default:     return 'bg-cat-extra/15 text-cat-extra';
  }
}

/** 12×12 icon tile on day/routine cards (icon inherits the text color) */
export function categoryTileClass(category: string): string {
  switch (category) {
    case 'push': return 'bg-cat-push/10 text-cat-push';
    case 'pull': return 'bg-cat-pull/10 text-cat-pull';
    case 'legs': return 'bg-cat-legs/10 text-cat-legs';
    case 'abs':  return 'bg-cat-abs/10 text-cat-abs';
    default:     return 'bg-cat-extra/10 text-cat-extra';
  }
}

/** Solid fill: history color bar, workout progress dot */
export function categorySolidClass(category: string): string {
  switch (category) {
    case 'push': return 'bg-cat-push';
    case 'pull': return 'bg-cat-pull';
    case 'legs': return 'bg-cat-legs';
    case 'abs':  return 'bg-cat-abs';
    default:     return 'bg-cat-extra';
  }
}

/** Category-colored text: workout header day label */
export function categoryTextClass(category: string): string {
  switch (category) {
    case 'push': return 'text-cat-push';
    case 'pull': return 'text-cat-pull';
    case 'legs': return 'text-cat-legs';
    case 'abs':  return 'text-cat-abs';
    default:     return 'text-cat-extra';
  }
}

/** Selected state of the pre-workout exercise choice buttons */
export function categorySelectedClass(category: string): string {
  switch (category) {
    case 'push': return 'border-cat-push bg-cat-push/10';
    case 'pull': return 'border-cat-pull bg-cat-pull/10';
    case 'legs': return 'border-cat-legs bg-cat-legs/10';
    case 'abs':  return 'border-cat-abs bg-cat-abs/10';
    default:     return 'border-cat-extra bg-cat-extra/10';
  }
}

/** Category identity icon — the single replacement for every category emoji */
export function categoryIcon(category: string): IconName {
  switch (category) {
    case 'push': return 'dumbbell';
    case 'pull': return 'pull-up';
    case 'legs': return 'squat';
    case 'abs':  return 'abs-grid';
    case 'additional': return 'zap';
    default:     return 'clipboard-list'; // custom routines
  }
}

/**
 * Runtime value of a --color-* token, for consumers that cannot use classes
 * (Chart.js, the PNG export background). Cached per token; falls back to a
 * neutral in DOM-less environments (Vitest runs in jsdom without the CSS).
 */
const tokenCache = new Map<string, string>();
export function themeToken(name: string): string {
  let value = tokenCache.get(name);
  if (value === undefined) {
    value = getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#75807a';
    tokenCache.set(name, value);
  }
  return value;
}

/** Chart color for a session category (reads the same cat tokens as the classes above) */
export function categoryChartColor(category: string): string {
  switch (category) {
    case 'push': return themeToken('--color-cat-push');
    case 'pull': return themeToken('--color-cat-pull');
    case 'legs': return themeToken('--color-cat-legs');
    case 'abs':  return themeToken('--color-cat-abs');
    default:     return themeToken('--color-cat-extra');
  }
}
