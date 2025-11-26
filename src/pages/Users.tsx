import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function Users() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">User Management</h2>
            <p className="text-muted-foreground">
              Manage user access and permissions
            </p>
          </div>
          <Button className="bg-nintex-orange hover:bg-nintex-orange-hover">
            Add User
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              View and manage user roles (User, Business Analyst, Promaster)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[500px] items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg bg-muted/10">
              <p className="text-muted-foreground">Users table will be displayed here</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
