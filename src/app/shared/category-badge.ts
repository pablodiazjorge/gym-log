/** Tailwind classes for the small category pill used by every exercise list */
export function categoryBadgeClass(category: string): string {
  switch (category) {
    case 'push':
      return 'bg-blue-500/20 text-blue-300';
    case 'pull':
      return 'bg-emerald-500/20 text-emerald-300';
    case 'legs':
      return 'bg-amber-500/20 text-amber-300';
    case 'abs':
      return 'bg-pink-500/20 text-pink-300';
    default:
      return 'bg-gray-700 text-gray-400';
  }
}
