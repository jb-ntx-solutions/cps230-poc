import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useSettings, useUpdateSetting, useSyncProcessManager, useSyncHistory } from '@/hooks/useSettings';
import { toast } from 'sonner';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function Settings() {
  const { data: settings = [], isLoading } = useSettings(['pm_site_url', 'pm_username', 'pm_password', 'pm_tenant_id']);
  const updateSettings = useUpdateSetting();
  const syncPM = useSyncProcessManager();
  const { data: syncHistory = [] } = useSyncHistory();

  const [siteUrl, setSiteUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [tenantId, setTenantId] = useState('');

  useEffect(() => {
    if (settings.length > 0) {
      setSiteUrl((settings.find(s => s.key === 'pm_site_url')?.value as string) || '');
      setUsername((settings.find(s => s.key === 'pm_username')?.value as string) || '');
      setPassword((settings.find(s => s.key === 'pm_password')?.value as string) || '');
      setTenantId((settings.find(s => s.key === 'pm_tenant_id')?.value as string) || '');
    }
  }, [settings]);

  const handleSaveConnection = async () => {
    try {
      await updateSettings.mutateAsync([
        { key: 'pm_site_url', value: siteUrl },
        { key: 'pm_username', value: username },
        { key: 'pm_password', value: password },
        { key: 'pm_tenant_id', value: tenantId },
      ]);
      toast.success('Connection settings saved successfully');
    } catch (error) {
      toast.error('Failed to save connection settings');
      console.error(error);
    }
  };

  const handleSyncNow = async () => {
    try {
      const result = await syncPM.mutateAsync();
      toast.success(
        `Sync completed! ${result.processesProcessed} processes synced, ${result.systemsAdded} systems added`
      );
    } catch (error) {
      toast.error(`Sync failed: ${error.message}`);
      console.error(error);
    }
  };

  const getSyncStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-muted-foreground">
            Configure application settings and integrations
          </p>
        </div>

        <Tabs defaultValue="nintex" className="space-y-6">
          <TabsList>
            <TabsTrigger value="nintex">Nintex Process Manager</TabsTrigger>
            <TabsTrigger value="regions">Regions</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
          </TabsList>

          <TabsContent value="nintex">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Nintex Process Manager Connection</CardTitle>
                  <CardDescription>
                    Configure connection to your Nintex Process Manager environment
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-40">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="site-url">Site URL</Label>
                        <Input
                          id="site-url"
                          type="text"
                          placeholder="demo.promapp.com"
                          value={siteUrl}
                          onChange={(e) => setSiteUrl(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Your Process Manager site URL (without https://)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tenant-id">Tenant ID</Label>
                        <Input
                          id="tenant-id"
                          type="text"
                          placeholder="93555a16ceb24f139a6e8a40618d3f8b"
                          value={tenantId}
                          onChange={(e) => setTenantId(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                          Your tenant ID from the Process Manager URL
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                          id="username"
                          type="text"
                          placeholder="user@example.com"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          className="bg-nintex-orange hover:bg-nintex-orange-hover"
                          onClick={handleSaveConnection}
                          disabled={updateSettings.isPending}
                        >
                          {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Save Connection
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleSyncNow}
                          disabled={syncPM.isPending || !siteUrl || !tenantId || !username || !password}
                        >
                          {syncPM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Sync Now
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Sync History</CardTitle>
                  <CardDescription>
                    Recent synchronization attempts with Process Manager
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {syncHistory.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      No sync history available
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {syncHistory.map((sync) => (
                        <div
                          key={sync.id}
                          className="flex items-start justify-between border-b pb-4 last:border-0"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {getSyncStatusIcon(sync.status)}
                              <span className="font-medium capitalize">{sync.status}</span>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {sync.records_synced} records synced
                            </p>
                            {sync.error_message && (
                              <p className="text-sm text-red-600">{sync.error_message}</p>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground text-right">
                            <p>{new Date(sync.started_at).toLocaleString()}</p>
                            <p className="text-xs">by {sync.initiated_by}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="regions">
            <Card>
              <CardHeader>
                <CardTitle>Available Regions</CardTitle>
                <CardDescription>
                  Configure the regions available for controls
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg bg-muted/10">
                  <p className="text-muted-foreground">Region configuration will be added here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                  Configure general application settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex h-[300px] items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg bg-muted/10">
                  <p className="text-muted-foreground">General settings will be added here</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
