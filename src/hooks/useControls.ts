import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Control } from '@/types/database';
import { useAuth } from '@/contexts/AuthContext';

export function useControls() {
  return useQuery({
    queryKey: ['controls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controls')
        .select(`
          *,
          critical_operation:critical_operations(operation_name),
          process:processes(process_name),
          system:systems(system_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Control[];
    },
  });
}

export function useCreateControl() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (control: Omit<Control, 'id' | 'created_at' | 'modified_date' | 'modified_by'>) => {
      const { data, error } = await supabase
        .from('controls')
        .insert({
          ...control,
          modified_by: user?.email || 'unknown',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controls'] });
    },
  });
}

export function useUpdateControl() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Control> & { id: string }) => {
      const { data, error } = await supabase
        .from('controls')
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
      queryClient.invalidateQueries({ queryKey: ['controls'] });
    },
  });
}

export function useDeleteControl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('controls')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['controls'] });
    },
  });
}
