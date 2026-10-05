import { useEffect, useMemo, useRef } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { newId } from '../../../../packages/contracts/src/index';
import type { ItemList, Page, PageFilter, PageItem, PageRecords, PagedItems, PagedList } from '../../../../packages/contracts/src/pages';
import { visibleRecords } from '../../../../packages/domain/src/engine';
import { itemOf, pageOf } from '../../../../packages/domain/src/pages';
import { api, demoState, mode } from './data';
import { useWorkspace } from './context';

/** One page of a long list: from the API in live mode, from the same rules over the fictional state in the demo. */
export async function loadPage<L extends PagedList>(slug: string, userId: string, list: L, cursor: string | null, limit?: number, filter: PageFilter = {}): Promise<Page<PagedItems[L]>> {
    if (mode === 'demo') {
        const s = demoState(slug), ctx = { organizationId: s.organisation.id, userId, requestId: newId() };
        return pageOf(visibleRecords(s, ctx), ctx, list, { cursor: cursor ?? undefined, limit, ...filter });
    }
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    if (limit) params.set('limit', String(limit));
    for (const [k, v] of Object.entries(filter)) if (v) params.set(k, String(v));
    return api(`/api/organisations/${encodeURIComponent(slug)}/pages/${list}${params.size ? '?' + params : ''}`);
}
/** One post or archived task by ID, with its records. */
export async function loadItem<L extends ItemList>(slug: string, userId: string, list: L, itemId: string): Promise<PageItem<PagedItems[L]>> {
    if (mode === 'demo') {
        const s = demoState(slug), ctx = { organizationId: s.organisation.id, userId, requestId: newId() };
        return itemOf(visibleRecords(s, ctx), ctx, list, itemId);
    }
    return api(`/api/organisations/${encodeURIComponent(slug)}/pages/${list}/items/${encodeURIComponent(itemId)}`);
}

const joinRecords = (all: (PageRecords | undefined)[]): PageRecords => {
    const out: Record<string, unknown[]> = {};
    for (const r of all) for (const [k, v] of Object.entries(r ?? {})) out[k] = [...(out[k] ?? []), ...(v as unknown[])];
    return out as PageRecords;
};

/**
 * A feed read a page at a time that keeps its place. When the community changes (its revision moves), every page already
 * shown is read again from the top, so a reply or appreciation shows on an older post without the list collapsing to its
 * first page, and nothing is skipped or repeated. Records the items need come with them, for `WithRecords`.
 */
export function useLivePages<L extends PagedList>(list: L, filter: PageFilter, options: { limit?: number; enabled?: boolean } = {}) {
    const { slug, userId, data } = useWorkspace();
    const query = useInfiniteQuery({
        queryKey: ['live-page', slug, userId, list, filter, options.limit ?? 0],
        queryFn: ({ pageParam }) => loadPage(slug, userId, list, pageParam, options.limit, filter),
        initialPageParam: null as string | null,
        getNextPageParam: last => last.nextCursor,
        enabled: options.enabled ?? true,
        retry: false,
        staleTime: 30000,
    });
    const revision = useRef(data.revision);
    const { refetch, isFetched } = query;
    useEffect(() => { if (revision.current !== data.revision) { revision.current = data.revision; if (isFetched) void refetch(); } }, [data.revision, isFetched, refetch]);
    const pages = query.data?.pages;
    const records = useMemo(() => joinRecords((pages ?? []).map(p => p.records)), [pages]);
    const items = useMemo(() => (pages ?? []).flatMap(p => p.items) as PagedItems[L][], [pages]);
    return {
        items,
        records,
        total: pages?.[0]?.total ?? null,
        loading: query.isPending,
        error: query.error,
        hasMore: !!query.hasNextPage,
        loadingMore: query.isFetchingNextPage,
        more: () => query.fetchNextPage(),
        retry: () => { void query.refetch(); },
        pageCount: pages?.length ?? 0,
    };
}

/** One post or archived task the snapshot does not carry, read only when `enabled` and again after each change. */
export function useLiveItem<L extends ItemList>(list: L, itemId: string | undefined, enabled: boolean) {
    const { slug, userId, data } = useWorkspace();
    return useQuery({
        queryKey: ['live-item', slug, userId, list, itemId, data.revision],
        queryFn: () => loadItem(slug, userId, list, itemId!),
        enabled: enabled && !!itemId,
        retry: false,
        placeholderData: previous => previous,
    });
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
        /** Read the list again after a failure. */
        retry: () => { void query.refetch(); },
        /** How many items the last page fetch added, for moving focus to the first of them. */
        pageCount: pages.length,
    };
}
