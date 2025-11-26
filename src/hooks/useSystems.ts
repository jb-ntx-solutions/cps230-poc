import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { System } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export function useSystems() {
  return useQuery({
    queryKey: ['systems'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('systems')
        .select('*')
        .order('system_name', { ascending: true });

      if (error) throw error;
      return data as System[];
    },
  });
}

export function useCreateSystem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (system: Omit<System, 'id' | 'created_at' | 'modified_date' | 'modified_by'>) => {
      const { data, error } = await supabase
        .from('systems')
        .insert({
          ...system,
          modified_by: user?.email || 'unknown',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systems'] });
    },
  });
}

export function useUpdateSystem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<System> & { id: string }) => {
      const { data, error } = await supabase
        .from('systems')
        .update({
          ...updates,
          modified_by: user?.email || 'unknown',
          modified_date: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systems'] });
    },
  });
}

export function useDeleteSystem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('systems')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['systems'] });
    },
  });
}
