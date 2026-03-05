import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CriticalOperation } from '@/types/database';
import type { CriticalOperationWithRelations } from '@/lib/api';
import { useCreateCriticalOperation, useUpdateCriticalOperation } from '@/hooks/useCriticalOperations';
import { useSystems } from '@/hooks/useSystems';
import { useProcesses } from '@/hooks/useProcesses';
import { toast } from 'sonner';

interface CriticalOperationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation?: CriticalOperationWithRelations | null;
}

interface CriticalOperationFormData {
  operation_name: string;
  description: string;
  system_id: string;
  color_code: string;
}

export function CriticalOperationDialog({
  open,
  onOpenChange,
  operation,
}: CriticalOperationDialogProps) {
  const createOperation = useCreateCriticalOperation();
  const updateOperation = useUpdateCriticalOperation();
  const { data: systems = [] } = useSystems();
  const { data: processes = [] } = useProcesses();
  const [selectedProcessIds, setSelectedProcessIds] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CriticalOperationFormData>({
    defaultValues: {
      operation_name: '',
      description: '',
      system_id: '',
      color_code: '',
    },
  });

  useEffect(() => {
    if (open && operation) {
      reset({
        operation_name: operation.operation_name,
        description: operation.description || '',
        system_id: operation.system_id || '',
        color_code: operation.color_code || '',
      });
      // Load existing process IDs
      setSelectedProcessIds(operation.processes?.map(p => p.id) || []);
    } else if (open) {
      reset({
        operation_name: '',
        description: '',
        system_id: '',
        color_code: '',
      });
      setSelectedProcessIds([]);
    }
  }, [open, operation, reset]);

  const onSubmit = async (data: CriticalOperationFormData) => {
    try {
      if (operation) {
        await updateOperation.mutateAsync({
          id: operation.id,
          operation_name: data.operation_name,
          description: data.description || null,
          system_id: data.system_id || null,
          color_code: data.color_code || null,
          processIds: selectedProcessIds,
        });
        toast.success('Critical operation updated successfully');
      } else {
        await createOperation.mutateAsync({
          operation_name: data.operation_name,
          description: data.description || null,
          system_id: data.system_id || null,
          color_code: data.color_code || null,
          processIds: selectedProcessIds,
        });
        toast.success('Critical operation created successfully');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(operation ? 'Failed to update operation' : 'Failed to create operation');
      console.error(error);
    }
  };

  const toggleProcess = (processId: string) => {
    setSelectedProcessIds(prev =>
      prev.includes(processId)
        ? prev.filter(id => id !== processId)
        : [...prev, processId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>
            {operation ? 'Edit Critical Operation' : 'Add New Critical Operation'}
          </DialogTitle>
          <DialogDescription>
            {operation
              ? 'Update the critical operation information below.'
              : 'Add a new critical operation for CPS230 compliance.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="operation_name">
                Operation Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="operation_name"
                {...register('operation_name', {
                  required: 'Operation name is required',
                })}
                placeholder="Enter operation name"
              />
              {errors.operation_name && (
                <p className="text-sm text-destructive">{errors.operation_name.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Enter operation description (optional)"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="system_id">Associated System</Label>
              <Select
                value={watch('system_id') || undefined}
                onValueChange={(value) => setValue('system_id', value === 'none' ? '' : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a system (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {systems.map((system) => (
                    <SelectItem key={system.id} value={system.id}>
                      {system.system_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Associated Processes</Label>
              <div className="border rounded-md p-3 max-h-48 overflow-y-auto">
                {processes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No processes available</p>
                ) : (
                  <div className="space-y-2">
                    {processes.map((process) => (
                      <div key={process.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`process-${process.id}`}
                          checked={selectedProcessIds.includes(process.id)}
                          onCheckedChange={() => toggleProcess(process.id)}
                        />
                        <label
                          htmlFor={`process-${process.id}`}
                          className="text-sm font-normal leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {process.process_name}
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedProcessIds.length} process{selectedProcessIds.length !== 1 ? 'es' : ''} selected
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="color_code">Color Code</Label>
              <div className="flex gap-2">
                <Input
                  id="color_code"
                  type="color"
                  {...register('color_code')}
                  className="w-20 h-10 p-1"
                />
                <Input
                  {...register('color_code')}
                  placeholder="#FF6633"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : operation ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
