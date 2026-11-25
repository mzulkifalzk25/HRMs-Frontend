// Typed `handle` for route objects: drives breadcrumbs (P1-T14) and the document title.
export type RouteHandle = {
  /** Breadcrumb label for this route. Omit to hide the route from breadcrumbs. */
  breadcrumb?: string
}

export function isRouteHandle(value: unknown): value is RouteHandle {
  return typeof value === 'object' && value !== null
}
