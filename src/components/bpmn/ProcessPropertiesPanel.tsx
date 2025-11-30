import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Copy, Check } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { toast } from 'sonner';

interface Process {
  id: string;
  process_name: string;
  process_unique_id: string;
  pm_process_id?: number | null;
  owner_username?: string | null;
  regions?: string[] | null;
  systems?: Array<{ id: string; system_name: string }>;
  controls?: Array<{ id: string; control_name: string }>;
  criticalOperations?: Array<{ id: string; operation_name: string }>;
}

interface ProcessPropertiesPanelProps {
  selectedProcessId: string | null;
  processes: Process[];
  onProcessLink: (processId: string) => void;
  onClose: () => void;
  readOnly?: boolean;
}

export function ProcessPropertiesPanel({
  selectedProcessId,
  processes,
  onProcessLink,
  onClose,
  readOnly = false
}: ProcessPropertiesPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Get site URL and tenant ID from settings
  const { data: settings } = useSettings(['pm_site_url', 'pm_tenant_id']);
  const pmSiteUrl = settings?.find(s => s.key === 'pm_site_url')?.value as string;
  const pmTenantId = settings?.find(s => s.key === 'pm_tenant_id')?.value as string;

  // Construct full base URL from site URL + tenant ID
  // Examples:
  // - https://demo.promapp.com/93555a16ceb24f139a6e8a40618d3f8b
  // - https://us.promapp.com/contoso
  const baseUrl = pmSiteUrl && pmTenantId ? `https://${pmSiteUrl}/${pmTenantId}` : '';

  const selectedProcess = processes.find(p => p.id === selectedProcessId);

  // Filter processes based on search
  const filteredProcesses = processes.filter(p =>
    p.process_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.process_unique_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProcessSelect = (processId: string) => {
    onProcessLink(processId);
  };

  // Construct full process URL: baseUrl + /Process/{uniqueId}
  const processUrl = selectedProcess && baseUrl
    ? `${baseUrl}/Process/${selectedProcess.process_unique_id}`
    : '';

  const handleCopyUrl = async () => {
    if (!processUrl) return;

    try {
      await navigator.clipboard.writeText(processUrl);
      setCopiedUrl(true);
      toast.success('URL copied to clipboard');
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      toast.error('Failed to copy URL');
    }
  };

  return (
    <div className="w-96 border-l bg-background overflow-y-auto">
      <Card className="rounded-none border-0">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">Process Properties</CardTitle>
              <CardDescription className="mt-1">
                View and manage process details
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
          {/* Process Search & Selector - only for editors */}
          {!readOnly && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Search Process</Label>
                <Input
                  placeholder="Search by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Select Process</Label>
                <Select value={selectedProcessId || undefined} onValueChange={handleProcessSelect}>
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
            </div>
          )}

          {/* Process Details */}
          {selectedProcess && (
            <div className={readOnly ? "space-y-4" : "border-t pt-4 space-y-4"}>
              {/* Process Name */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Process Name</Label>
                <p className="text-sm font-medium">{selectedProcess.process_name}</p>
              </div>

              {/* Process URL */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Process URL</Label>
                <div className="flex gap-2 items-start">
                  <a
                    href={processUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-xs font-mono text-primary hover:underline break-all bg-muted p-2 rounded border border-input"
                  >
                    {processUrl}
                  </a>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyUrl}
                    title="Copy URL"
                    className="shrink-0"
                  >
                    {copiedUrl ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Process Unique ID */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Process Unique ID</Label>
                <p className="text-xs font-mono break-all bg-muted p-2 rounded">
                  {selectedProcess.process_unique_id}
                </p>
              </div>

              {/* PM Process ID */}
              {selectedProcess.pm_process_id && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">PM Process ID</Label>
                  <p className="text-sm font-mono">{selectedProcess.pm_process_id}</p>
                </div>
              )}

              {/* Owner */}
              {selectedProcess.owner_username && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Owner</Label>
                  <p className="text-sm">{selectedProcess.owner_username}</p>
                </div>
              )}

              {/* Regions */}
              {selectedProcess.regions && selectedProcess.regions.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Regions</Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedProcess.regions.map((region) => (
                      <Badge key={region} variant="secondary" className="text-xs">
                        {region}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Systems */}
              {selectedProcess.systems && selectedProcess.systems.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Related Systems</Label>
                  <div className="flex flex-col gap-1">
                    {selectedProcess.systems.map((system) => (
                      <Badge key={system.id} variant="outline" className="text-xs justify-start">
                        {system.system_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Controls */}
              {selectedProcess.controls && selectedProcess.controls.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Related Controls</Label>
                  <div className="flex flex-col gap-1">
                    {selectedProcess.controls.map((control) => (
                      <Badge key={control.id} variant="outline" className="text-xs justify-start">
                        {control.control_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Critical Operations */}
              {selectedProcess.criticalOperations && selectedProcess.criticalOperations.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Critical Operations</Label>
                  <div className="flex flex-col gap-1">
                    {selectedProcess.criticalOperations.map((operation) => (
                      <Badge key={operation.id} variant="destructive" className="text-xs justify-start">
                        {operation.operation_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
