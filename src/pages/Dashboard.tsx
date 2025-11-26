import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Process Model Canvas</CardTitle>
            <CardDescription>
              Visualize and edit the connections between processes for CPS230 Critical Operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-[600px] items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg bg-muted/10">
              <div className="text-center space-y-2">
                <svg
                  className="h-12 w-12 text-muted-foreground/50 mx-auto"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-lg font-medium text-muted-foreground">
                  BPMN.js Canvas Integration
                </p>
                <p className="text-sm text-muted-foreground/75">
                  The process visualization canvas will be integrated here
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
