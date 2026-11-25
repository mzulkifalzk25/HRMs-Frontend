// Accessible reporting tree (P3-T13): WAI-ARIA tree pattern with a roving tabindex.
// Keys: ↑/↓ move, → expand or go to first child, ← collapse or go to parent, Home/End,
// Enter/Space toggle. Large trees start collapsed below the second level.
import { ChevronRight, Users } from 'lucide-react'
import { useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { StatusBadge } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'
import { subtreeSize, type ReportingTreeNode } from '../lib/hierarchy'
import type { ReportingLine } from '../schemas/organization.schema'

type Node = ReportingTreeNode<ReportingLine>
type VisibleItem = { node: Node; level: number; parentId: string | null }

function initialExpanded(nodes: Node[], depth = 0, acc = new Set<string>()): Set<string> {
  for (const node of nodes) {
    if (depth < 1 && node.children.length > 0) acc.add(node.person.id)
    initialExpanded(node.children, depth + 1, acc)
  }
  return acc
}

function flatten(
  nodes: Node[],
  expanded: Set<string>,
  level = 1,
  parentId: string | null = null,
): VisibleItem[] {
  return nodes.flatMap((node) => [
    { node, level, parentId },
    ...(expanded.has(node.person.id)
      ? flatten(node.children, expanded, level + 1, node.person.id)
      : []),
  ])
}

export function OrgChartTree({
  tree,
  nameOf,
  canOpenProfiles,
  forceExpanded = false,
}: {
  tree: Node[]
  nameOf: (id: string) => string
  canOpenProfiles: boolean
  /** Expand everything (used while searching). */
  forceExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(() => initialExpanded(tree))
  const allIds = useMemo(() => {
    const ids = new Set<string>()
    const walk = (nodes: Node[]) =>
      nodes.forEach((n) => (n.children.length > 0 && ids.add(n.person.id), walk(n.children)))
    walk(tree)
    return ids
  }, [tree])
  const effective = forceExpanded ? allIds : expanded
  const visible = flatten(tree, effective)
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const activeId = visible.some((item) => item.node.person.id === focusedId)
    ? focusedId
    : (visible[0]?.node.person.id ?? null)
  const refs = useRef(new Map<string, HTMLLIElement>())

  const focus = (id: string | undefined) => {
    if (!id) return
    setFocusedId(id)
    refs.current.get(id)?.focus()
  }
  const toggle = (id: string, open?: boolean) =>
    setExpanded((current) => {
      const next = new Set(forceExpanded ? allIds : current)
      if (open ?? !next.has(id)) next.add(id)
      else next.delete(id)
      return next
    })

  function onKeyDown(event: KeyboardEvent<HTMLLIElement>, item: VisibleItem) {
    const index = visible.findIndex((v) => v.node.person.id === item.node.person.id)
    const id = item.node.person.id
    const hasChildren = item.node.children.length > 0
    const isOpen = effective.has(id)
    const handled = true
    switch (event.key) {
      case 'ArrowDown':
        focus(visible[index + 1]?.node.person.id)
        break
      case 'ArrowUp':
        focus(visible[index - 1]?.node.person.id)
        break
      case 'Home':
        focus(visible[0]?.node.person.id)
        break
      case 'End':
        focus(visible.at(-1)?.node.person.id)
        break
      case 'ArrowRight':
        if (hasChildren && !isOpen) toggle(id, true)
        else if (hasChildren) focus(item.node.children[0]?.person.id)
        break
      case 'ArrowLeft':
        if (hasChildren && isOpen) toggle(id, false)
        else focus(item.parentId ?? undefined)
        break
      case 'Enter':
      case ' ':
        if (hasChildren) toggle(id)
        break
      default:
        return
    }
    if (handled) event.preventDefault()
  }

  const renderItems = (nodes: Node[], level: number): React.ReactNode =>
    nodes.map((node) => {
      const id = node.person.id
      const hasChildren = node.children.length > 0
      const isOpen = effective.has(id)
      const visibleItem = visible.find((v) => v.node.person.id === id)
      return (
        <li
          key={id}
          ref={(el) => {
            if (el) refs.current.set(id, el)
            else refs.current.delete(id)
          }}
          role="treeitem"
          aria-level={level}
          aria-expanded={hasChildren ? isOpen : undefined}
          aria-label={`${node.person.name}${node.person.designation ? `, ${node.person.designation}` : ''}${hasChildren ? `, ${subtreeSize(node) - 1} reports` : ''}`}
          tabIndex={id === activeId ? 0 : -1}
          onKeyDown={(event) => {
            if (event.target === event.currentTarget && visibleItem) onKeyDown(event, visibleItem)
          }}
          onFocus={(event) => event.target === event.currentTarget && setFocusedId(id)}
          className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <div
            className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
            style={{ paddingLeft: `${(level - 1) * 1.25 + 0.5}rem` }}
          >
            {hasChildren ? (
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                onClick={() => toggle(id)}
                className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
              >
                <ChevronRight
                  className={cn('size-4 transition-transform', isOpen && 'rotate-90')}
                />
              </button>
            ) : (
              <span aria-hidden="true" className="size-5 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                {canOpenProfiles ? (
                  <Link
                    to={`/employees/${id}`}
                    tabIndex={-1}
                    className="font-medium hover:text-primary hover:underline"
                  >
                    {node.person.name}
                  </Link>
                ) : (
                  <span className="font-medium">{node.person.name}</span>
                )}
                {node.person.status !== 'active' ? (
                  <StatusBadge tone="neutral">
                    {node.person.status === 'inactive' ? 'Inactive' : 'Invited'}
                  </StatusBadge>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {[node.person.designation, node.person.departmentName]
                  .filter(Boolean)
                  .join(' · ') || '—'}
                {node.alsoReportsTo.length > 0
                  ? ` · Also reports to ${node.alsoReportsTo.map(nameOf).join(', ')}`
                  : ''}
              </p>
            </div>
            {hasChildren ? (
              <span
                className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums"
                aria-hidden="true"
              >
                <Users className="size-3.5" />
                {subtreeSize(node) - 1}
              </span>
            ) : null}
          </div>
          {hasChildren && isOpen ? (
            <ul role="group" className="space-y-0.5">
              {renderItems(node.children, level + 1)}
            </ul>
          ) : null}
        </li>
      )
    })

  return (
    <ul role="tree" aria-label="Reporting hierarchy" className="space-y-0.5">
      {renderItems(tree, 1)}
    </ul>
  )
}
