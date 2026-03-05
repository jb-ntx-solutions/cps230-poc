import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { criticalOperationsApi } from '@/lib/api';
import type { CriticalOperation } from '@/types/database';

export function useCriticalOperations() {
  return useQuery({
    queryKey: ['critical_operations'],
    queryFn: () => criticalOperationsApi.getAll(),
  });
}

export function useCreateCriticalOperation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ processIds, ...operation }: Omit<CriticalOperation, 'id' | 'created_at' | 'modified_date' | 'modified_by'> & { processIds?: string[] }) =>
      criticalOperationsApi.create(operation, processIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['critical_operations'] });
    },
  });
}

export function useUpdateCriticalOperation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, processIds, ...updates }: Partial<CriticalOperation> & { id: string; processIds?: string[] }) =>
      criticalOperationsApi.update(id, updates, processIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['critical_operations'] });
    },
  });
}

export function useDeleteCriticalOperation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => criticalOperationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['critical_operations'] });
    },
  });
}
