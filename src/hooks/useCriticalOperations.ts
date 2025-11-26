import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { CriticalOperation } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export function useCriticalOperations() {
  return useQuery({
    queryKey: ['critical_operations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('critical_operations')
        .select('*, system:systems(system_name), process:processes(process_name)')
        .order('operation_name', { ascending: true });

      if (error) throw error;
      return data as CriticalOperation[];
    },
  });
}

export function useCreateCriticalOperation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (operation: Omit<CriticalOperation, 'id' | 'created_at' | 'modified_date' | 'modified_by'>) => {
      const { data, error } = await supabase
        .from('critical_operations')
        .insert({
          ...operation,
          modified_by: user?.email || 'unknown',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['critical_operations'] });
    },
  });
}

export function useUpdateCriticalOperation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<CriticalOperation> & { id: string }) => {
      const { data, error } = await supabase
        .from('critical_operations')
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
      queryClient.invalidateQueries({ queryKey: ['critical_operations'] });
    },
  });
}

export function useDeleteCriticalOperation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('critical_operations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['critical_operations'] });
    },
  });
}
