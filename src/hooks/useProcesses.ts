import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Process } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export interface ProcessWithSystems extends Process {
  systems?: Array<{
    id: string;
    system_name: string;
  }>;
}

export function useProcesses() {
  return useQuery({
    queryKey: ['processes'],
    queryFn: async () => {
      // First get all processes
      const { data: processes, error: processError } = await supabase
        .from('processes')
        .select('*')
        .order('process_name', { ascending: true });

      if (processError) throw processError;

      // For each process, get its associated systems
      const processesWithSystems = await Promise.all(
        (processes || []).map(async (process) => {
          const { data: processSystems } = await supabase
            .from('process_systems')
            .select(`
              system_id,
              systems:system_id (
                id,
                system_name
              )
            `)
            .eq('process_id', process.id);

          return {
            ...process,
            systems: processSystems?.map(ps => ps.systems).filter(Boolean) || [],
          } as ProcessWithSystems;
        })
      );

      return processesWithSystems;
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
