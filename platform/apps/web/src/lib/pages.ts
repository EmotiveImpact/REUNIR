import { useInfiniteQuery } from '@tanstack/react-query';
import { newId } from '../../../../packages/contracts/src/index';
import type { Page, PagedItems, PagedList } from '../../../../packages/contracts/src/pages';
import { visibleRecords } from '../../../../packages/domain/src/engine';
import { pageOf } from '../../../../packages/domain/src/pages';
import { api, demoState, mode } from './data';
import { useWorkspace } from './context';

/** One page of a long list: from the API in live mode, from the same rules over the fictional state in the demo. */
export async function loadPage<L extends PagedList>(slug: string, userId: string, list: L, cursor: string | null, limit?: number): Promise<Page<PagedItems[L]>> {
    if (mode === 'demo') {
        const s = demoState(slug), ctx = { organizationId: s.organisation.id, userId, requestId: newId() };
        return pageOf(visibleRecords(s, ctx), ctx, list, { cursor: cursor ?? undefined, limit });
    }
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', String(limit));
    return api(`/api/organisations/${encodeURIComponent(slug)}/pages/${list}${params.size ? '?' + params : ''}`);
}

/**
 * A list read a page at a time. It starts again from the first page whenever the community changes (its revision moves),
 * so a review that was just sent or a notice that was just read never shows stale.
 */
export function usePagedList<L extends PagedList>(list: L, options: { limit?: number; enabled?: boolean } = {}) {
    const { slug, userId, data } = useWorkspace();
    const query = useInfiniteQuery({
        queryKey: ['page', slug, userId, list, data.revision, data.summary?.unreadNotifications ?? 0, options.limit ?? 0],
        queryFn: ({ pageParam }) => loadPage(slug, userId, list, pageParam, options.limit),
        initialPageParam: null as string | null,
        getNextPageParam: last => last.nextCursor,
        enabled: options.enabled ?? true,
        retry: false,
        staleTime: 30000,
    });
    const pages = query.data?.pages ?? [];
    return {
        items: pages.flatMap(p => p.items) as PagedItems[L][],
        total: pages[0]?.total ?? 0,
        loading: query.isPending,
        error: query.error,
        hasMore: !!query.hasNextPage,
        loadingMore: query.isFetchingNextPage,
        more: () => query.fetchNextPage(),
        /** How many items the last page fetch added, for moving focus to the first of them. */
        pageCount: pages.length,
    };
}
