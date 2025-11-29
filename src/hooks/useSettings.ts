import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
    queryFn: async () => {
      let query = supabase.from('settings').select('*');

      if (keys && keys.length > 0) {
        query = query.in('key', keys);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Setting[];
    },
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: { key: string; value: any }[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('email, account_id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      const updates = settings.map(setting => ({
        key: setting.key,
        value: setting.value,
        modified_by: profile.email,
        account_id: profile.account_id,
      }));

      const { error } = await supabase
        .from('settings')
        .upsert(updates, { onConflict: 'key,account_id' });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useSyncProcessManager() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-process-manager`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Sync failed');
      }

      return await response.json();
    },
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
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_history')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data;
    },
    refetchInterval, // Auto-refetch at specified interval
  });
}

export function useLatestSync() {
  return useQuery({
    queryKey: ['latest-sync'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_history')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // Ignore "no rows" error
      return data;
    },
    refetchInterval: 2000, // Poll every 2 seconds
  });
}
