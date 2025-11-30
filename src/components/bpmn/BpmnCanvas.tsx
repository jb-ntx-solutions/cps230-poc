import { useEffect, useRef, useState, useCallback } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';
import { getModelerConfig } from './modeler';
import { ProcessPropertiesPanel } from './ProcessPropertiesPanel';
import { FilterState } from './utils/highlightCalculator';
import { generateBpmnFromProcesses, generateEmptyDiagram } from './utils/bpmnXmlGenerator';
import { Button } from '@/components/ui/button';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings, useUpdateSetting } from '@/hooks/useSettings';

interface ProcessData {
  id: string;
  process_name: string;
  process_unique_id: string;
  pm_process_id: number;
  owner_username: string | null;
  input_processes?: string[] | null;
  output_processes?: string[] | null;
  canvas_position?: { x: number; y: number } | null;
  regions?: string[] | null;
  systems?: Array<{ id: string; system_name: string }>;
  controls?: Array<{ id: string }>;
  criticalOperations?: Array<{ id: string }>;
}

interface BpmnCanvasProps {
  processes: ProcessData[];
  userRole: 'promaster' | 'business_analyst' | 'user';
  filters: FilterState;
}

export function BpmnCanvas({
  processes,
  userRole,
  filters
}: BpmnCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { data: settings = [] } = useSettings(['bpmn_diagram']);
  const updateSettings = useUpdateSetting();

  const savedDiagramXml = (settings.find(s => s.key === 'bpmn_diagram')?.value as { xml: string })?.xml;

  // Save diagram function
  const saveDiagram = useCallback(async () => {
    if (!modelerRef.current) return;

    try {
      setIsSaving(true);
      const { xml } = await modelerRef.current.saveXML({ format: true });

      await updateSettings.mutateAsync([{
        key: 'bpmn_diagram',
        value: { xml }
      }]);

      setHasUnsavedChanges(false);
      toast.success('Diagram saved successfully');
    } catch (err) {
      console.error('Error saving diagram:', err);
      toast.error('Failed to save diagram');
    } finally {
      setIsSaving(false);
    }
  }, [updateSettings]);

  // Initialize BPMN modeler
  useEffect(() => {
    if (!containerRef.current) return;

    const config = getModelerConfig(userRole);
    const modeler = new BpmnModeler({
      container: containerRef.current,
      keyboard: {
        bindTo: document,
      },
      ...config,
    });

    modelerRef.current = modeler;

    // Determine which BPMN XML to load
    let bpmnXml: string;
    if (savedDiagramXml) {
      // Use saved diagram if available
      bpmnXml = savedDiagramXml;
    } else if (processes.length > 0) {
      // Generate from processes if no saved diagram (initial state)
      bpmnXml = generateBpmnFromProcesses(processes);
    } else {
      // Empty diagram
      bpmnXml = generateEmptyDiagram();
    }

    modeler.importXML(bpmnXml).then(() => {
      const canvas = modeler.get('canvas') as any;
      canvas.zoom('fit-viewport');

      // Set read-only mode for basic users
      if (userRole === 'user') {
        const eventBus = modeler.get('eventBus') as any;

        // Prevent all editing operations
        eventBus.on('commandStack.shape.create.preExecute', 10000, () => false);
        eventBus.on('commandStack.shape.delete.preExecute', 10000, () => false);
        eventBus.on('commandStack.connection.create.preExecute', 10000, () => false);
        eventBus.on('commandStack.connection.delete.preExecute', 10000, () => false);
        eventBus.on('commandStack.elements.move.preExecute', 10000, () => false);
        eventBus.on('commandStack.shape.resize.preExecute', 10000, () => false);
        eventBus.on('commandStack.element.updateProperties.preExecute', 10000, () => false);

        // Disable context pad and palette for read-only mode
        modeler.get('contextPad').close();
        modeler.get('palette').close();
      }
    }).catch((err: Error) => {
      console.error('Error importing BPMN diagram:', err);
      setError('Failed to load process diagram');
    });

    // Listen for element selection
    const eventBus = modeler.get('eventBus') as any;
    eventBus.on('selection.changed', (event: any) => {
      const { newSelection } = event;

      if (newSelection.length === 1) {
        const element = newSelection[0];
        setSelectedElement(element);

        // Extract process ID from Call Activity
        if (element.type === 'bpmn:CallActivity') {
          const modeling = modeler.get('modeling') as any;
          const processId = element.businessObject.calledElement;
          setSelectedProcessId(processId || null);
        } else {
          setSelectedProcessId(null);
        }
      } else {
        setSelectedElement(null);
        setSelectedProcessId(null);
      }
    });

    // Track changes for unsaved changes indicator
    if (userRole !== 'user') {
      eventBus.on('commandStack.changed', () => {
        setHasUnsavedChanges(true);
      });
    }

    // Cleanup
    return () => {
      modeler.destroy();
    };
  }, [savedDiagramXml, processes, userRole]);

  // Apply highlighting when filters change
  useEffect(() => {
    if (!modelerRef.current) return;

    const canvas = modelerRef.current.get('canvas') as any;
    const elementRegistry = modelerRef.current.get('elementRegistry') as any;
    const overlays = modelerRef.current.get('overlays') as any;

    // Clear all existing overlays
    overlays.clear();

    // Reset all element styles
    elementRegistry.forEach((element: any) => {
      if (element.type === 'bpmn:CallActivity') {
        canvas.removeMarker(element, 'highlight-system');
        canvas.removeMarker(element, 'highlight-control');
        canvas.removeMarker(element, 'highlight-critical');
      }
    });

    // Apply new highlighting based on filters
    const hasActiveFilters =
      filters.systems.length > 0 ||
      filters.regions.length > 0 ||
      filters.controls.length > 0 ||
      filters.criticalOperations.length > 0;

    if (!hasActiveFilters) return;

    elementRegistry.forEach((element: any) => {
      if (element.type !== 'bpmn:CallActivity') return;

      const processId = element.businessObject.calledElement;
      const processData = processes.find(p => p.id === processId);

      if (!processData) return;

      // Priority: Critical Operations > Controls > Systems
      let applied = false;

      // Check Critical Operations (RED border - highest priority)
      if (!applied && filters.criticalOperations.length > 0) {
        const matchesCriticalOp = processData.criticalOperations?.some(co =>
          filters.criticalOperations.includes(co.id)
        );

        if (matchesCriticalOp) {
          canvas.addMarker(element, 'highlight-critical');
          applied = true;
        }
      }

      // Check Controls (BLUE border - second priority)
      if (!applied && filters.controls.length > 0) {
        const matchesControl = processData.controls?.some(ctrl =>
          filters.controls.includes(ctrl.id)
        );

        if (matchesControl) {
          canvas.addMarker(element, 'highlight-control');
          applied = true;
        }
      }

      // Check Systems (GREEN border - third priority)
      if (!applied && filters.systems.length > 0) {
        const matchesSystem = processData.systems?.some(sys =>
          filters.systems.includes(sys.id)
        );

        if (matchesSystem) {
          canvas.addMarker(element, 'highlight-system');
          applied = true;
        }
      }

      // Check Regions (OVERLAY - independent of border)
      if (filters.regions.length > 0 && processData.regions) {
        const matchedRegions = processData.regions.filter(region =>
          filters.regions.includes(region)
        );

        if (matchedRegions.length > 0) {
          const regionHtml = `
            <div style="
              background: rgba(59, 130, 246, 0.9);
              color: white;
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 10px;
              font-weight: 500;
              white-space: nowrap;
              box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            ">
              ${matchedRegions.join(', ')}
            </div>
          `;

          overlays.add(element, {
            position: { top: -5, right: 10 },
            html: regionHtml
          });
        }
      }
    });
  }, [filters, processes]);

  // Handle process linking from property panel
  const handleProcessLink = (processId: string) => {
    if (!modelerRef.current || !selectedElement) return;

    const modeling = modelerRef.current.get('modeling') as any;
    const process = processes.find(p => p.id === processId);

    if (!process) return;

    // Update Call Activity with process information
    modeling.updateProperties(selectedElement, {
      name: process.process_name,
      calledElement: process.id
    });

    setSelectedProcessId(processId);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        {error}
      </div>
    );
  }

  const canEdit = userRole === 'promaster' || userRole === 'business_analyst';

  return (
    <div className="flex h-full">
      {/* BPMN Canvas */}
      <div className="flex-1 relative">
        {/* Save Button - only show for editors */}
        {canEdit && (
          <div className="absolute top-4 right-4 z-10 flex gap-2">
            <Button
              onClick={saveDiagram}
              disabled={isSaving || !hasUnsavedChanges}
              size="sm"
              className="shadow-lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {hasUnsavedChanges ? 'Save Diagram' : 'Saved'}
                </>
              )}
            </Button>
          </div>
        )}

        <div
          ref={containerRef}
          className="w-full h-full"
        />

        {/* Add custom CSS for highlighting */}
        <style>{`
          .highlight-system .djs-visual > :nth-child(1) {
            stroke: #10b981 !important;
            stroke-width: 4 !important;
          }

          .highlight-control .djs-visual > :nth-child(1) {
            stroke: #3b82f6 !important;
            stroke-width: 4 !important;
          }

          .highlight-critical .djs-visual > :nth-child(1) {
            stroke: #ef4444 !important;
            stroke-width: 4 !important;
          }
        `}</style>
      </div>

      {/* Properties Panel (shown for all users when element is selected) */}
      {selectedElement?.type === 'bpmn:CallActivity' && (
        <ProcessPropertiesPanel
          selectedProcessId={selectedProcessId}
          processes={processes}
          onProcessLink={handleProcessLink}
          onClose={() => {
            const selection = modelerRef.current?.get('selection') as any;
            selection?.deselect(selectedElement);
          }}
          readOnly={userRole === 'user'}
        />
      )}
    </div>
  );
}
