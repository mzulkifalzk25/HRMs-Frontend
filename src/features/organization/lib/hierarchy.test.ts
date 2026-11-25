// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildReportingTree, findReportingCycle, subtreeSize, transitiveReports } from './hierarchy'

//      ceo
//     /    \
//   mgrA   mgrB
//    |  \  /
//   tl   dev   (dev reports to both mgrA and mgrB)
//    |
//   eng
const people = [
  { id: 'ceo', managerIds: [] },
  { id: 'mgrA', managerIds: ['ceo'] },
  { id: 'mgrB', managerIds: ['ceo'] },
  { id: 'tl', managerIds: ['mgrA'] },
  { id: 'dev', managerIds: ['mgrA', 'mgrB'] },
  { id: 'eng', managerIds: ['tl'] },
  { id: 'solo', managerIds: [] }, // no manager
]

describe('findReportingCycle', () => {
  it('allows valid assignments, including several managers and none', () => {
    expect(findReportingCycle(people, 'eng', ['tl', 'mgrB'])).toBeNull()
    expect(findReportingCycle(people, 'dev', [])).toBeNull()
    expect(findReportingCycle(people, 'solo', ['ceo'])).toBeNull()
  })

  it('blocks reporting to yourself', () => {
    expect(findReportingCycle(people, 'tl', ['tl'])).toEqual(['tl', 'tl'])
  })

  it('blocks a direct cycle', () => {
    expect(findReportingCycle(people, 'mgrA', ['tl'])).toEqual(['mgrA', 'tl', 'mgrA'])
  })

  it('blocks an indirect cycle several levels down', () => {
    expect(findReportingCycle(people, 'ceo', ['eng'])).toEqual(['ceo', 'eng', 'tl', 'mgrA', 'ceo'])
  })

  it('finds a cycle through a second manager of a multi-manager person', () => {
    // mgrB -> dev would close mgrB → dev → mgrB (dev already reports to mgrB)
    expect(findReportingCycle(people, 'mgrB', ['solo', 'dev'])).toEqual(['mgrB', 'dev', 'mgrB'])
  })

  it('ignores the person’s old managers (they are being replaced)', () => {
    // eng currently reports to tl; moving eng to report to ceo is fine.
    expect(findReportingCycle(people, 'eng', ['ceo'])).toBeNull()
  })
})

describe('transitiveReports', () => {
  it('collects direct and indirect reports once, across multiple managers', () => {
    expect([...transitiveReports(people, 'ceo')].sort()).toEqual([
      'dev',
      'eng',
      'mgrA',
      'mgrB',
      'tl',
    ])
    expect([...transitiveReports(people, 'mgrA')].sort()).toEqual(['dev', 'eng', 'tl'])
    expect([...transitiveReports(people, 'mgrB')]).toEqual(['dev'])
    expect(transitiveReports(people, 'eng').size).toBe(0)
  })

  it('terminates on cyclic data', () => {
    const cyclic = [
      { id: 'a', managerIds: ['b'] },
      { id: 'b', managerIds: ['a'] },
    ]
    expect([...transitiveReports(cyclic, 'a')]).toEqual(['b'])
  })
})

describe('buildReportingTree', () => {
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)

  it('puts people without managers at the root and nests the rest', () => {
    const tree = buildReportingTree(people, byId)
    expect(tree.map((node) => node.person.id)).toEqual(['ceo', 'solo'])
    const ceo = tree[0]
    expect(ceo?.children.map((node) => node.person.id)).toEqual(['mgrA', 'mgrB'])
    expect(ceo && subtreeSize(ceo)).toBe(6)
  })

  it('shows a multi-manager person once, under the first manager, listing the others', () => {
    const tree = buildReportingTree(people, byId)
    const mgrA = tree[0]?.children[0]
    const mgrB = tree[0]?.children[1]
    const dev = mgrA?.children.find((node) => node.person.id === 'dev')
    expect(dev?.alsoReportsTo).toEqual(['mgrB'])
    expect(mgrB?.children).toEqual([])
  })

  it('treats unknown managers as missing and never loses people in cyclic data', () => {
    const tree = buildReportingTree(
      [
        { id: 'x', managerIds: ['someone-out-of-scope'] },
        { id: 'a', managerIds: ['b'] },
        { id: 'b', managerIds: ['a'] },
      ],
      byId,
    )
    const ids = (nodes: typeof tree): string[] =>
      nodes.flatMap((n) => [n.person.id, ...ids(n.children)])
    expect(ids(tree).sort()).toEqual(['a', 'b', 'x'])
  })
})
