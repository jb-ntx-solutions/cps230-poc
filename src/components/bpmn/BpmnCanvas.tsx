import { useEffect, useRef, useState } from 'react';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

interface Process {
  id: string;
  process_name: string;
  process_unique_id: string;
  input_processes?: string[];
  output_processes?: string[];
  canvas_position?: { x: number; y: number };
}

interface BpmnCanvasProps {
  processes: Process[];
  onSavePositions?: (positions: Record<string, { x: number; y: number }>) => void;
}

// Generate BPMN XML from processes
function generateBpmnXml(processes: Process[]): string {
  const processElements = processes.map((process, index) => {
    const x = process.canvas_position?.x || 100 + (index % 5) * 200;
    const y = process.canvas_position?.y || 100 + Math.floor(index / 5) * 150;

    return `
      <bpmn:task id="${process.id}" name="${process.process_name}">
        <bpmn:incoming>${process.input_processes?.map(id => `flow_${id}_${process.id}`).join(' ') || ''}</bpmn:incoming>
        <bpmn:outgoing>${process.output_processes?.map(id => `flow_${process.id}_${id}`).join(' ') || ''}</bpmn:outgoing>
      </bpmn:task>
      <bpmndi:BPMNShape id="${process.id}_di" bpmnElement="${process.id}">
        <dc:Bounds x="${x}" y="${y}" width="100" height="80" />
      </bpmndi:BPMNShape>
    `;
  }).join('\n');

  // Generate sequence flows
  const flows: string[] = [];
  const flowDiagrams: string[] = [];

  processes.forEach(process => {
    process.output_processes?.forEach(targetId => {
      const flowId = `flow_${process.id}_${targetId}`;
      flows.push(`
        <bpmn:sequenceFlow id="${flowId}" sourceRef="${process.id}" targetRef="${targetId}" />
      `);

      flowDiagrams.push(`
        <bpmndi:BPMNEdge id="${flowId}_di" bpmnElement="${flowId}">
          <di:waypoint x="0" y="0" />
          <di:waypoint x="0" y="0" />
        </bpmndi:BPMNEdge>
      `);
    });
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                   xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                   xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                   xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                   id="Definitions_1"
                   targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    ${processElements}
    ${flows.join('\n')}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      ${flowDiagrams.join('\n')}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

export function BpmnCanvas({ processes, onSavePositions }: BpmnCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const modelerRef = useRef<BpmnModeler | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize BPMN modeler
    const modeler = new BpmnModeler({
      container: containerRef.current,
      keyboard: {
        bindTo: document,
      },
    });

    modelerRef.current = modeler;

    // Generate and import BPMN diagram
    const bpmnXml = generateBpmnXml(processes);

    modeler.importXML(bpmnXml).then(() => {
      const canvas = modeler.get('canvas') as any;
      canvas.zoom('fit-viewport');
    }).catch((err: Error) => {
      console.error('Error importing BPMN diagram:', err);
      setError('Failed to load process diagram');
    });

    // Listen for element position changes
    const eventBus = modeler.get('eventBus') as any;
    eventBus.on('element.changed', () => {
      if (onSavePositions) {
        // Extract positions from the diagram
        const elementRegistry = modeler.get('elementRegistry') as any;
        const positions: Record<string, { x: number; y: number }> = {};

        processes.forEach(process => {
          const element = elementRegistry.get(process.id);
          if (element && element.x !== undefined && element.y !== undefined) {
            positions[process.id] = { x: element.x, y: element.y };
          }
        });

        onSavePositions(positions);
      }
    });

    // Cleanup
    return () => {
      modeler.destroy();
    };
  }, [processes, onSavePositions]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: '600px' }}
    />
  );
}
