import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BpmnCanvas } from '@/components/bpmn/BpmnCanvas';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface Process {
  id: string;
  process_name: string;
  process_unique_id: string;
  pm_process_id: number;
  owner_username: string | null;
  input_processes: string[] | null;
  output_processes: string[] | null;
  canvas_position: { x: number; y: number } | null;
}

interface System {
  id: string;
  system_name: string;
  pm_tag_id: string;
}

interface ProcessSystem {
  process_id: string;
  system_id: string;
}

export default function Dashboard() {
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch all systems
  const { data: systems, isLoading: systemsLoading } = useQuery({
    queryKey: ['systems'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('systems')
        .select('*')
        .order('system_name');

      if (error) throw error;
      return data as System[];
    },
  });

  // Fetch all processes
  const { data: processes, isLoading: processesLoading } = useQuery({
    queryKey: ['processes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processes')
        .select('*')
        .order('process_name');

      if (error) throw error;
      return data as Process[];
    },
  });

  // Fetch process-system relationships
  const { data: processSystemsData, isLoading: processSystemsLoading } = useQuery({
    queryKey: ['process_systems'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('process_systems')
        .select('*');

      if (error) throw error;
      return data as ProcessSystem[];
    },
  });

  // Save canvas positions
  const savePositionsMutation = useMutation({
    mutationFn: async (positions: Record<string, { x: number; y: number }>) => {
      const updates = Object.entries(positions).map(([processId, position]) => ({
        id: processId,
        canvas_position: position,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('processes')
          .update({ canvas_position: update.canvas_position })
          .eq('id', update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processes'] });
      toast({
        title: 'Positions saved',
        description: 'Canvas positions have been saved successfully',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error saving positions',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Filter processes by selected system
  const filteredProcesses = selectedSystemId && processSystemsData && processes
    ? processes.filter(process =>
        processSystemsData.some(ps =>
          ps.process_id === process.id && ps.system_id === selectedSystemId
        )
      )
    : processes || [];

  const isLoading = systemsLoading || processesLoading || processSystemsLoading;

  return (
    <AppLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Process Model Canvas</CardTitle>
                <CardDescription>
                  Visualize and edit the connections between processes for CPS230 Critical Operations
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-64">
                  <Select
                    value={selectedSystemId || 'all'}
                    onValueChange={(value) => setSelectedSystemId(value === 'all' ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filter by System" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Systems</SelectItem>
                      {systems?.map((system) => (
                        <SelectItem key={system.id} value={system.id}>
                          {system.system_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => {
                    if (processes) {
                      const positions: Record<string, { x: number; y: number }> = {};
                      processes.forEach(p => {
                        if (p.canvas_position) {
                          positions[p.id] = p.canvas_position;
                        }
                      });
                      savePositionsMutation.mutate(positions);
                    }
                  }}
                  disabled={savePositionsMutation.isPending}
                >
                  {savePositionsMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Positions
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-[600px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProcesses.length === 0 ? (
              <div className="flex h-[600px] items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg bg-muted/10">
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium text-muted-foreground">
                    No processes found
                  </p>
                  <p className="text-sm text-muted-foreground/75">
                    {selectedSystemId
                      ? 'No processes are associated with the selected system'
                      : 'Sync processes from Nintex Process Manager in Settings'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <BpmnCanvas
                  processes={filteredProcesses}
                  onSavePositions={(positions) => savePositionsMutation.mutate(positions)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
