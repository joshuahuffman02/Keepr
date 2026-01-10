export const compact = <T>(items: Array<T | null | undefined | false>): T[] =>
  items.filter((item): item is T => Boolean(item));
