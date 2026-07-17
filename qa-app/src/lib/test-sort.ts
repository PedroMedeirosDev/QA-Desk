import type { TestRecord } from "@/types/test-record";
import type { Homologation } from "@/types/homologation";

function testIdOrder(id: string): number {
  const m = /-(\d+)$/.exec(id);
  return m ? Number(m[1]) : 9999;
}

/** Ordem do checklist (testKeys) → fallback TEST-2026-NNN. */
export function sortTestRecords(
  list: TestRecord[],
  homologations: Pick<Homologation, "testKeys">[] = [],
): TestRecord[] {
  const keyOrder = new Map<string, number>();
  let idx = 0;
  for (const h of homologations) {
    for (const key of h.testKeys ?? []) {
      if (!keyOrder.has(key)) keyOrder.set(key, idx++);
    }
  }

  return [...list].sort((a, b) => {
    const oa = a.testKey != null ? keyOrder.get(a.testKey) : undefined;
    const ob = b.testKey != null ? keyOrder.get(b.testKey) : undefined;
    if (oa !== undefined && ob !== undefined) return oa - ob;
    if (oa !== undefined) return -1;
    if (ob !== undefined) return 1;
    return testIdOrder(a.id) - testIdOrder(b.id);
  });
}
