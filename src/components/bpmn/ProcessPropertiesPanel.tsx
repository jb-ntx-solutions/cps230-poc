import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExternalLink, X } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';

interface Process {
  id: string;
  process_name: string;
  process_unique_id: string;
  pm_process_id?: number | null;
  owner_username?: string | null;
}

interface ProcessPropertiesPanelProps {
  selectedElement: any | null;
  processes: Process[];
  onProcessLink: (elementId: string, processId: string) => void;
  onClose: () => void;
}

export function ProcessPropertiesPanel({
  selectedElement,
  processes,
  onProcessLink,
  onClose
}: ProcessPropertiesPanelProps) {
  const [selectedProcessId, setSelectedProcessId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Get Process Manager settings for "Open in PM" link
  const { data: settings } = useSettings(['pm_site_url', 'pm_tenant_id']);
  const pmSiteUrl = settings?.find(s => s.key === 'pm_site_url')?.value as string;
  const pmTenantId = settings?.find(s => s.key === 'pm_tenant_id')?.value as string;

  // Get linked process from element's calledElement or custom extension
  useEffect(() => {
    if (!selectedElement) {
      setSelectedProcessId('');
      return;
    }

    // Try to get from calledElement attribute
    const calledElement = selectedElement.businessObject?.calledElement;
    if (calledElement) {
      setSelectedProcessId(calledElement);
      return;
    }

    // Try to get from custom extension
    const extensionElements = selectedElement.businessObject?.extensionElements;
    if (extensionElements?.values) {
      const processData = extensionElements.values.find((el: any) =>
        el.$type === 'custom:ProcessData'
      );
      if (processData?.processId) {
        setSelectedProcessId(processData.processId);
      }
    }
  }, [selectedElement]);

  if (!selectedElement || selectedElement.type !== 'bpmn:CallActivity') {
    return null;
  }

  const selectedProcess = processes.find(p => p.id === selectedProcessId);

  // Filter processes based on search
  const filteredProcesses = processes.filter(p =>
    p.process_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.process_unique_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProcessSelect = (processId: string) => {
    setSelectedProcessId(processId);
    onProcessLink(selectedElement.id, processId);
  };

  const handleOpenInPM = () => {
    if (!selectedProcess || !pmSiteUrl || !pmTenantId) return;

    const url = `https://${pmSiteUrl}/${pmTenantId}/Process/${selectedProcess.process_unique_id}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="w-80 border-l bg-background overflow-y-auto">
      <Card className="rounded-none border-0">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">Call Activity Properties</CardTitle>
              <CardDescription className="mt-1">
                Link this activity to a process
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Element Info */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Element ID</Label>
            <Input
              value={selectedElement.id}
              readOnly
              className="text-xs font-mono bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Element Name</Label>
            <Input
              value={selectedElement.businessObject?.name || '(unnamed)'}
              readOnly
              className="text-xs bg-muted"
            />
          </div>

          <div className="border-t pt-4 space-y-3">
            {/* Process Search */}
            <div className="space-y-2">
              <Label>Search Process</Label>
              <Input
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Process Selector */}
            <div className="space-y-2">
              <Label>Linked Process *</Label>
              <Select value={selectedProcessId} onValueChange={handleProcessSelect}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Select a process..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredProcesses.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No processes found
                    </div>
                  ) : (
                    filteredProcesses.map((process) => (
                      <SelectItem key={process.id} value={process.id} className="text-sm">
                        <div className="flex flex-col">
                          <span>{process.process_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {process.process_unique_id}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Linked Process Details */}
            {selectedProcess && (
              <div className="mt-4 space-y-3 p-3 rounded-lg bg-muted/50">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Process Name</Label>
                  <p className="text-sm font-medium">{selectedProcess.process_name}</p>
                </div>

                {selectedProcess.pm_process_id && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">PM Process ID</Label>
                    <p className="text-sm font-mono">{selectedProcess.pm_process_id}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Process Unique ID</Label>
                  <p className="text-xs font-mono break-all">{selectedProcess.process_unique_id}</p>
                </div>

                {selectedProcess.owner_username && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Owner</Label>
                    <p className="text-sm">{selectedProcess.owner_username}</p>
                  </div>
                )}

                {/* Open in Process Manager */}
                {pmSiteUrl && pmTenantId && (
                  <Button
                    onClick={handleOpenInPM}
                    className="w-full mt-3"
                    variant="outline"
                    size="sm"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in Process Manager
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
