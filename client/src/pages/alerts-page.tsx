import Sidebar from "@/components/layout/sidebar";
import Topbar from "@/components/layout/topbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function AlertsPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      
      <div className="md:ml-64 min-h-screen">
        <Topbar title="Alerts" />
        
        <main className="p-4 md:p-6 max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Service Alerts</h1>
            <p className="text-gray-600">Monitor and manage alerts from your services</p>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Active Alerts</CardTitle>
                  <CardDescription>View and acknowledge alerts from your services</CardDescription>
                </div>
                <Button variant="outline" className="flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  Filter Alerts
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center h-60 text-center">
                  <AlertTriangle className="h-12 w-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-600">Alerts Page</h3>
                  <p className="text-gray-500 max-w-md mt-2">
                    This page is under development. Soon you'll be able to manage all service alerts from here.
                  </p>
                  <p className="text-gray-400 mt-1 text-sm">
                    For now, please use the Dashboard to view alerts.
                  </p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => window.location.href = "/"}
                  >
                    Go to Dashboard
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}