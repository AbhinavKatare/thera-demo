import { z } from 'zod';

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor: string | null;
  limit: number;
  total?: number;
}

export function paginateArray<T extends { id: string }>(
  items: T[],
  limit: number,
  cursor?: string,
): PaginatedResponse<T> {
  let startIndex = 0;
  if (cursor) {
    const foundIndex = items.findIndex((it) => it.id === cursor);
    if (foundIndex !== -1) {
      startIndex = foundIndex + 1;
    }
  }

  const slice = items.slice(startIndex, startIndex + limit);
  const hasMore = startIndex + limit < items.length;
  const nextCursor = hasMore && slice.length > 0 ? slice[slice.length - 1]!.id : null;

  return {
    items: slice,
    nextCursor,
    limit,
    total: items.length,
  };
}
