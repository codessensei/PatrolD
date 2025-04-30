import React, { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, Server, AlertTriangle, History, Settings, 
  LogOut, Cpu, Zap, Menu, X, Share2 
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logoutMutation } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [location] = useLocation();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const navItems = [
    { path: "/", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
    { path: "/services", label: "Services", icon: <Server className="h-5 w-5" /> },
    { path: "/alerts", label: "Alerts", icon: <AlertTriangle className="h-5 w-5" /> },
    { path: "/agents", label: "Agents", icon: <Cpu className="h-5 w-5" /> },
    { path: "/history", label: "History", icon: <History className="h-5 w-5" /> },
    { path: "/shared-maps", label: "Shared Maps", icon: <Share2 className="h-5 w-5" /> },
    { path: "/settings", label: "Settings", icon: <Settings className="h-5 w-5" /> },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed md:h-full z-40 transition-transform md:relative",
          "w-72 md:w-64 lg:w-72 bg-card border-r border-border/40",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="h-full flex flex-col">
          {/* Logo and Brand */}
          <div className="p-6 border-b border-border/40">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center space-x-3 group">
                <div>
                  <div className="relative h-9 w-9 bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-500 rounded-lg flex items-center justify-center shadow-md group-hover:shadow-lg transition-all duration-300">
                    <Zap className="h-5 w-5 text-white" />
                    <div className="absolute h-2 w-2 bg-green-500 right-0 top-0 rounded-full"></div>
                  </div>
                </div>
                <div>
                  <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-indigo-600 dark:from-blue-400 dark:to-indigo-500">
                    PatrolD
                  </span>
                </div>
              </Link>
              
              <button
                className="md:hidden"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Navigation */}
          <div className="flex-1 overflow-y-auto p-2">
            <nav className="flex flex-col space-y-1">
              {navItems.map((item) => (
                <Link key={item.path} href={item.path}>
                  <Button
                    variant={location === item.path ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start",
                      location === item.path ? "bg-accent" : ""
                    )}
                  >
                    {item.icon}
                    <span className="ml-3">{item.label}</span>
                  </Button>
                </Link>
              ))}
            </nav>
          </div>
          
          {/* Sidebar Footer */}
          <div className="p-4 border-t border-border/40">
            <div className="flex items-center">
              <div className="ml-2 flex-1">
                <p className="text-sm font-medium">{user?.username}</p>
                <p className="text-xs text-muted-foreground">{user?.email || 'No email provided'}</p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleLogout}
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>
      
      {/* Main Content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="h-16 border-b border-border/40 bg-card/80 backdrop-blur-sm flex items-center px-4">
          <button
            className="md:hidden mr-4"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          
          <div className="flex-1 flex items-center justify-between">
            <h1 className="text-lg font-semibold">
              {navItems.find(item => item.path === location)?.label || "Dashboard"}
            </h1>
            <div className="flex items-center gap-2">
              {/* Import and add ThemeToggle here */}
              {React.createElement(
                // Dynamically import to avoid direct import issues
                require("@/components/theme-toggle").ThemeToggle
              )}
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <ScrollArea className="flex-1 p-2 md:p-4">
          <main className="w-full max-w-full mx-auto px-2 md:px-4">{children}</main>
        </ScrollArea>
      </div>
    </div>
  );
};

export default Layout;