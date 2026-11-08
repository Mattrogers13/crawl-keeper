// Identical monsters share one line under the GM row (UI review Q9 C, Matt
// 2026-11-08): a long fight's list stays short. Identical: the same name once
// a trailing number goes ("Goblin", "Goblin 2", "Goblin #3") and the same
// token image, so two different "Guard" tokens stay apart. Pure: no SDK, no
// React.

const TRAILING_NUMBER = /\s*#?\d+$/;

// The name a stack shows: "Goblin" for "Goblin 2" (a name that is only a
// number keeps it).
export const stackName = (name: string) => name.trim().replace(TRAILING_NUMBER, "") || name.trim();

export const stackKey = (name: string, image: string | null) => `${stackName(name).toLowerCase()}|${image ?? ""}`;

export type Stack<T> = { key: string; members: T[] };

// In the order shown: each stack where its first member is; members keep
// their order (a lone monster is a stack of one).
export const stacks = <T>(items: T[], keyOf: (item: T) => string): Stack<T>[] => {
  const byKey = new Map<string, Stack<T>>();
  const out: Stack<T>[] = [];
  for (const item of items) {
    const key = keyOf(item);
    const found = byKey.get(key);
    if (found) found.members.push(item);
    else {
      const stack = { key, members: [item] };
      byKey.set(key, stack);
      out.push(stack);
    }
  }
  return out;
};
