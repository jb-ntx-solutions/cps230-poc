import { AppLayout } from '@/components/AppLayout';
import { BpmnCanvas } from '@/components/bpmn/BpmnCanvas';
import { FiltersSidebar } from '@/components/bpmn/FiltersSidebar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { FilterState } from '@/components/bpmn/utils/highlightCalculator';
import { useAuth } from '@/contexts/AuthContext';

interface Process {
  id: string;
  process_name: string;
  process_unique_id: string;
  pm_process_id: number;
  owner_username: string | null;
  input_processes: string[] | null;
  output_processes: string[] | null;
  canvas_position: { x: number; y: number } | null;
  regions: string[] | null;
}

interface System {
  id: string;
  system_name: string;
  pm_tag_id: string;
}

interface Control {
  id: string;
  control_id: string | null;
  control_name: string | null;
}

interface CriticalOperation {
  id: string;
  operation_name: string;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [filters, setFilters] = useState<FilterState>({
    systems: [],
    regions: [],
    controls: [],
    criticalOperations: []
  });

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

  // Fetch all processes with related data
  const { data: processes, isLoading: processesLoading } = useQuery({
    queryKey: ['processes-with-relations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processes')
        .select(`
          *,
          process_systems!inner (
            system:systems (
              id,
              system_name
            )
          ),
          controls!controls_process_id_fkey (
            id
          ),
          critical_operations!critical_operations_process_id_fkey (
            id
          )
        `)
        .order('process_name');

      if (error) throw error;

      // Transform the data to include systems, controls, and critical operations
      return (data || []).map((process: any) => ({
        id: process.id,
        process_name: process.process_name,
        process_unique_id: process.process_unique_id,
        pm_process_id: process.pm_process_id,
        owner_username: process.owner_username,
        input_processes: process.input_processes,
        output_processes: process.output_processes,
        canvas_position: process.canvas_position,
        regions: process.regions,
        systems: process.process_systems?.map((ps: any) => ps.system).filter(Boolean) || [],
        controls: process.controls || [],
        criticalOperations: process.critical_operations || []
      }));
    },
  });

  // Fetch all controls
  const { data: controls, isLoading: controlsLoading } = useQuery({
    queryKey: ['controls'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controls')
        .select('id, control_id, control_name')
        .order('control_name');

      if (error) throw error;
      return data as Control[];
    },
  });

  // Fetch all critical operations
  const { data: criticalOperations, isLoading: criticalOpsLoading } = useQuery({
    queryKey: ['critical-operations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('critical_operations')
        .select('id, operation_name')
        .order('operation_name');

      if (error) throw error;
      return data as CriticalOperation[];
    },
  });

  // Extract unique regions from processes
  const regions = Array.from(
    new Set(
      processes?.flatMap(p => p.regions || []).filter(Boolean) || []
    )
  ).sort();

  const isLoading = systemsLoading || processesLoading || controlsLoading || criticalOpsLoading;

  const userRole = profile?.role || 'user';

  return (
    <AppLayout>
      {isLoading ? (
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex h-[calc(100vh-4rem)]">
          {/* Filters Sidebar */}
          <FiltersSidebar
            systems={systems || []}
            regions={regions}
            controls={controls || []}
            criticalOperations={criticalOperations || []}
            selectedFilters={filters}
            onFilterChange={setFilters}
          />

          {/* BPMN Canvas */}
          <div className="flex-1 overflow-hidden">
            {processes && processes.length > 0 ? (
              <BpmnCanvas
                processes={processes}
                userRole={userRole as 'promaster' | 'business_analyst' | 'user'}
                filters={filters}
              />
            ) : (
              <div className="flex h-full items-center justify-center border-2 border-dashed border-muted-foreground/25 bg-muted/10">
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium text-muted-foreground">
                    No processes found
                  </p>
                  <p className="text-sm text-muted-foreground/75">
                    Sync processes from Nintex Process Manager in Settings
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
