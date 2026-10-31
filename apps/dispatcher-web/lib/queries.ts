'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DigitalToken, TokenStatus } from '@transitlink/shared';
import { getDataSource } from './dataSource';

export const keys = {
  snapshot: ['snapshot'] as const,
  tokens: ['tokens'] as const,
};

/** Routes, stops, buses, trips — changes rarely, so cached indefinitely. */
export function useSnapshot() {
  return useQuery({
    queryKey: keys.snapshot,
    queryFn: () => getDataSource().getSnapshot(),
    staleTime: Infinity,
  });
}

/** Tokens are fetched once, then kept fresh by `token:update` socket events (see RealtimeBridge). */
export function useTokens() {
  return useQuery({
    queryKey: keys.tokens,
    queryFn: () => getDataSource().getTokens(),
    staleTime: Infinity,
  });
}

export function upsertToken(list: DigitalToken[] | undefined, t: DigitalToken): DigitalToken[] {
  const rest = (list ?? []).filter((x) => x.id !== t.id);
  return [...rest, t];
}

export function useUpdateTokenStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TokenStatus }) =>
      getDataSource().updateTokenStatus(id, status),
    // Optimistic: dispatcher clicks should feel instant; roll back if the server refuses.
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: keys.tokens });
      const prev = qc.getQueryData<DigitalToken[]>(keys.tokens);
      qc.setQueryData<DigitalToken[]>(keys.tokens, (list) =>
        list?.map((t) => (t.id === id ? { ...t, status } : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(keys.tokens, ctx.prev),
    onSuccess: (t) => qc.setQueryData<DigitalToken[]>(keys.tokens, (list) => upsertToken(list, t)),
  });
}
