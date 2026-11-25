import { Fragment } from 'react'
import { Link, useMatches } from 'react-router'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { isRouteHandle } from '@/app/router/route-handle'

/** Breadcrumbs built from each matched route's `handle.breadcrumb`. */
export function AppBreadcrumbs() {
  const crumbs = useMatches().flatMap((match) =>
    isRouteHandle(match.handle) && match.handle.breadcrumb
      ? [{ id: match.id, label: match.handle.breadcrumb, to: match.pathname }]
      : [],
  )
  if (crumbs.length === 0) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <Fragment key={crumb.id}>
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={crumb.to}>{crumb.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {isLast ? null : <BreadcrumbSeparator />}
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
