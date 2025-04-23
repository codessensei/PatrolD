import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard,
  Server,
  AlertTriangle,
  History,
  Settings,
  LogOut
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" />, href: "/" },
  { label: "Services", icon: <Server className="h-5 w-5" />, href: "/services" },
  { label: "Alerts", icon: <AlertTriangle className="h-5 w-5" />, href: "/alerts" },
  { label: "History", icon: <History className="h-5 w-5" />, href: "/history" },
  { label: "Settings", icon: <Settings className="h-5 w-5" />, href: "/settings" },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <>
      {/* Mobile Sidebar Toggle */}
      <button 
        className="md:hidden fixed z-50 bottom-4 right-4 bg-primary text-white rounded-full p-3 shadow-lg dark:shadow-md dark:shadow-gray-900"
        onClick={toggleMobileMenu}
      >
        {isMobileMenuOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 w-full md:w-64 fixed md:h-full z-30 transition-transform sidebar-transition",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="relative h-8 w-8">
                  <div className="absolute inset-0 bg-primary rounded-md flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="absolute -right-1 -top-1 h-3 w-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-700"></div>
                </div>
                <span className="text-lg font-semibold text-gray-800 dark:text-gray-100">UptimeMonitor</span>
              </div>
              <button 
                className="md:hidden text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-gray-100"
                onClick={toggleMobileMenu}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <nav className="flex-grow p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <div
                key={item.href}
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  window.location.href = item.href;
                }}
                className={cn(
                  "flex items-center px-3 py-2 rounded-md cursor-pointer",
                  location === item.href 
                    ? "text-gray-600 dark:text-gray-200 bg-gray-100 dark:bg-gray-700" 
                    : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                <span className={cn(
                  "mr-3",
                  location === item.href ? "text-primary" : ""
                )}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </div>
            ))}
          </nav>
          
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-200 font-medium mr-3">
                {user?.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{user?.username}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email || "User"}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="ml-auto text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
