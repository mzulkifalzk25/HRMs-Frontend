// Reporting-hierarchy logic (P3-T12, P3-T13, P3-T14). Pure functions; the backend enforces the
// same rules (D-027). Supports several managers per person and people without a manager.

export type HierarchyPerson = { id: string; managerIds: readonly string[] }

/** Manager-id lists keyed by person id. Unknown manager ids are kept (the server may know them). */
function managerMap(people: readonly HierarchyPerson[]): Map<string, readonly string[]> {
  return new Map(people.map((person) => [person.id, person.managerIds]))
}

/**
 * Would giving `personId` the managers `newManagerIds` create a reporting cycle
 * (including reporting to themselves)? Returns the cycle path, e.g. ['a', 'b', 'a'], or null.
 */
export function findReportingCycle(
  people: readonly HierarchyPerson[],
  personId: string,
  newManagerIds: readonly string[],
): string[] | null {
  const managers = managerMap(people)
  managers.set(personId, newManagerIds)

  // Depth-first search upwards from each new manager, looking for personId.
  for (const start of newManagerIds) {
    if (start === personId) return [personId, personId]
    const stack: Array<{ id: string; path: string[] }> = [{ id: start, path: [personId, start] }]
    const seen = new Set<string>()
    while (stack.length > 0) {
      const current = stack.pop()
      if (!current || seen.has(current.id)) continue
      seen.add(current.id)
      for (const next of managers.get(current.id) ?? []) {
        if (next === personId) return [...current.path, personId]
        stack.push({ id: next, path: [...current.path, next] })
      }
    }
  }
  return null
}

/** Everyone who reports to `managerId`, directly or indirectly (each person once). */
export function transitiveReports(
  people: readonly HierarchyPerson[],
  managerId: string,
): Set<string> {
  const reportsOf = new Map<string, string[]>()
  for (const person of people) {
    for (const manager of person.managerIds) {
      reportsOf.set(manager, [...(reportsOf.get(manager) ?? []), person.id])
    }
  }
  const result = new Set<string>()
  const queue = [...(reportsOf.get(managerId) ?? [])]
  while (queue.length > 0) {
    const id = queue.shift()
    if (!id || result.has(id) || id === managerId) continue
    result.add(id)
    queue.push(...(reportsOf.get(id) ?? []))
  }
  return result
}

export type ReportingTreeNode<T extends HierarchyPerson> = {
  person: T
  /** Other managers this person also reports to (they appear only once in the tree). */
  alsoReportsTo: string[]
  children: ReportingTreeNode<T>[]
}

/**
 * Build a display tree. People with no (known) manager are roots. Someone with several
 * managers is placed under the first known one and lists the others in `alsoReportsTo`,
 * so nobody appears twice. Defensive against cycles in bad data: each person is placed once.
 */
export function buildReportingTree<T extends HierarchyPerson>(
  people: readonly T[],
  compare: (a: T, b: T) => number = () => 0,
): ReportingTreeNode<T>[] {
  const byId = new Map(people.map((person) => [person.id, person]))
  const childrenOf = new Map<string, T[]>()
  const roots: T[] = []
  for (const person of people) {
    const known = person.managerIds.filter((id) => id !== person.id && byId.has(id))
    const primary = known[0]
    if (primary) childrenOf.set(primary, [...(childrenOf.get(primary) ?? []), person])
    else roots.push(person)
  }

  const placed = new Set<string>()
  const build = (person: T): ReportingTreeNode<T> => {
    placed.add(person.id)
    const known = person.managerIds.filter((id) => id !== person.id && byId.has(id))
    const children = (childrenOf.get(person.id) ?? [])
      .filter((child) => !placed.has(child.id))
      .sort(compare)
      .map(build)
    return { person, alsoReportsTo: known.slice(1), children }
  }

  const tree = roots.sort(compare).map(build)
  // People only reachable through a cycle in bad data become roots instead of disappearing.
  for (const person of people) {
    if (!placed.has(person.id)) tree.push(build(person))
  }
  return tree
}

/** Count people in a subtree (including the node). */
export function subtreeSize<T extends HierarchyPerson>(node: ReportingTreeNode<T>): number {
  return 1 + node.children.reduce((sum, child) => sum + subtreeSize(child), 0)
}
