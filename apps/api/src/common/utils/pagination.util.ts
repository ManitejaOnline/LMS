import type { PaginatedMeta, PaginatedResult } from '@zebl/shared';

export function buildPaginatedResult<T>(
  items: T[],
  totalItems: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  const meta: PaginatedMeta = {
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
  };

  return { items, meta };
}

export function paginationSkip(page: number, pageSize: number): number {
  return (page - 1) * pageSize;
}
