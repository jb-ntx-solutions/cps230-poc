import { useState } from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '@/components/DataTable';
import { ProcessDialog } from './ProcessDialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useProcesses, useDeleteProcess } from '@/hooks/useProcesses';
import { useAuth } from '@/contexts/AuthContext';
import type { Process } from '@/types/database';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function ProcessesTable() {
  const { data: processes = [], isLoading } = useProcesses();
  const deleteProcess = useDeleteProcess();
  const { isBusinessAnalyst } = useAuth();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [processToDelete, setProcessToDelete] = useState<Process | null>(null);

  const handleEdit = (process: Process) => {
    setSelectedProcess(process);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setSelectedProcess(null);
    setDialogOpen(true);
  };

  const handleDeleteClick = (process: Process) => {
    setProcessToDelete(process);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!processToDelete) return;

    try {
      await deleteProcess.mutateAsync(processToDelete.id);
      toast.success('Process deleted successfully');
      setDeleteDialogOpen(false);
      setProcessToDelete(null);
    } catch (error) {
      toast.error('Failed to delete process');
      console.error(error);
    }
  };

  const columns: ColumnDef<Process>[] = [
    {
      accessorKey: 'process_name',
      header: 'Process Name',
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue('process_name')}</div>
      ),
    },
    {
      accessorKey: 'process_unique_id',
      header: 'Unique ID',
      cell: ({ row }) => (
        <div className="text-muted-foreground text-sm">
          {row.getValue('process_unique_id')}
        </div>
      ),
    },
    {
      accessorKey: 'owner_username',
      header: 'Owner',
      cell: ({ row }) => {
        const owner = row.getValue('owner_username') as string | null;
        return (
          <div className="text-sm">{owner || <span className="text-muted-foreground">—</span>}</div>
        );
      },
    },
    {
      accessorKey: 'modified_date',
      header: 'Last Modified',
      cell: ({ row }) => {
        const date = row.getValue('modified_date') as string;
        return (
          <div className="text-sm text-muted-foreground">
            {format(new Date(date), 'MMM d, yyyy')}
          </div>
        );
      },
    },
    {
      accessorKey: 'modified_by',
      header: 'Modified By',
      cell: ({ row }) => (
        <div className="text-sm text-muted-foreground">
          {row.getValue('modified_by')}
        </div>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const process = row.original;

        if (!isBusinessAnalyst) return null;

        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleEdit(process)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleDeleteClick(process)}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="text-muted-foreground">Loading processes...</div>
      </div>
    );
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={processes}
        searchColumn="process_name"
        searchPlaceholder="Search processes..."
        onAdd={isBusinessAnalyst ? handleAdd : undefined}
        addLabel="Add Process"
        showAdd={isBusinessAnalyst}
      />

      <ProcessDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        process={selectedProcess}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the process "{processToDelete?.process_name}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
