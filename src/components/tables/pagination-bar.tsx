// Server-side pagination controls, reused by every paginated list.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useId } from 'react'
import { NativeSelect } from '@/components/forms/native-select'
import { Button } from '@/components/ui/button'

type PaginationBarProps = {
  page: number
  pageSize: number
  total: number
  pageSizes: readonly number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  /** Noun for the status text, e.g. "employees". */
  itemLabel: string
}

export function PaginationBar({
  page,
  pageSize,
  total,
  pageSizes,
  onPageChange,
  onPageSizeChange,
  itemLabel,
}: PaginationBarProps) {
  const sizeId = useId()
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(total, page * pageSize)

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p aria-live="polite" className="text-muted-foreground tabular-nums">
        {total === 0 ? `No ${itemLabel}` : `Showing ${first}–${last} of ${total} ${itemLabel}`}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label htmlFor={sizeId} className="text-muted-foreground">
            Rows per page
          </label>
          <NativeSelect
            id={sizeId}
            className="w-20"
            value={String(pageSize)}
            options={pageSizes.map((size) => ({ value: String(size), label: String(size) }))}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          />
        </div>
        <span className="text-muted-foreground tabular-nums">
          Page {Math.min(page, pageCount)} of {pageCount}
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={page >= pageCount}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </nav>
  )
}
