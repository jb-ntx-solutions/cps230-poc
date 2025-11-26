import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export default function Settings() {
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
            <Card>
              <CardHeader>
                <CardTitle>Nintex Process Manager Connection</CardTitle>
                <CardDescription>
                  Configure connection to your Nintex Process Manager environment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="api-url">API URL</Label>
                  <Input
                    id="api-url"
                    type="url"
                    placeholder="https://your-tenant.promapp.com/api"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your Nintex Process Manager tenant API URL
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username">Service Account Username</Label>
                  <Input id="username" type="text" placeholder="service-account@example.com" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Service Account Password</Label>
                  <Input id="password" type="password" placeholder="••••••••" />
                </div>

                <div className="flex space-x-2">
                  <Button className="bg-nintex-orange hover:bg-nintex-orange-hover">
                    Save Connection
                  </Button>
                  <Button variant="outline">Test Connection</Button>
                  <Button variant="outline">Sync Now</Button>
                </div>
              </CardContent>
            </Card>
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
