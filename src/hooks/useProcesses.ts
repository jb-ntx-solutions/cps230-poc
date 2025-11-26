import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Process } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export function useProcesses() {
  return useQuery({
    queryKey: ['processes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processes')
        .select('*')
        .order('process_name', { ascending: true });

      if (error) throw error;
      return data as Process[];
    },
  });
}

export function useCreateProcess() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (process: Omit<Process, 'id' | 'created_at' | 'modified_date' | 'modified_by'>) => {
      const { data, error } = await supabase
        .from('processes')
        .insert({
          ...process,
          modified_by: user?.email || 'unknown',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
    },
  });
}

export function useUpdateProcess() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Process> & { id: string }) => {
      const { data, error } = await supabase
        .from('processes')
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
      queryClient.invalidateQueries({ queryKey: ['processes'] });
    },
  });
}

export function useDeleteProcess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('processes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
    },
  });
}
