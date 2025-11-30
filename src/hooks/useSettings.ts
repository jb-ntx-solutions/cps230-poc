import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi, syncProcessManagerApi, syncHistoryApi } from '@/lib/api';
import type { Setting } from '@/types/database';

export interface ProcessManagerSettings {
  pm_site_url?: string;
  pm_username?: string;
  pm_password?: string;
  pm_tenant_id?: string;
}

export function useSettings(keys?: string[]) {
  return useQuery({
    queryKey: keys ? ['settings', ...keys] : ['settings'],
    queryFn: () => settingsApi.getAll(keys),
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: { key: string; value: any }[]) =>
      settingsApi.upsert(settings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useSyncProcessManager() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => syncProcessManagerApi.sync(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      queryClient.invalidateQueries({ queryKey: ['systems'] });
      queryClient.invalidateQueries({ queryKey: ['sync-history'] });
    },
  });
}

export function useSyncHistory(refetchInterval?: number) {
  return useQuery({
    queryKey: ['sync-history'],
    queryFn: () => syncHistoryApi.getAll(10),
    refetchInterval, // Auto-refetch at specified interval
  });
}

export function useLatestSync() {
  return useQuery({
    queryKey: ['latest-sync'],
    queryFn: () => syncHistoryApi.getLatest(),
    refetchInterval: 2000, // Poll every 2 seconds
  });
}

export function useCancelSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (syncId: string) => syncHistoryApi.cancel(syncId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-history'] });
      queryClient.invalidateQueries({ queryKey: ['latest-sync'] });
    },
  });
}
