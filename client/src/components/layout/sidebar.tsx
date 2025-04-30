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
  LogOut,
  Cpu,
  Zap,
  Menu,
  X,
  Share2
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" />, href: "/" },
  { label: "Services", icon: <Server className="h-5 w-5" />, href: "/services" },
  { label: "Alerts", icon: <AlertTriangle className="h-5 w-5" />, href: "/alerts" },
  { label: "Agents", icon: <Cpu className="h-5 w-5" />, href: "/agents" },
  { label: "History", icon: <History className="h-5 w-5" />, href: "/history" },
  { label: "Shared Maps", icon: <Share2 className="h-5 w-5" />, href: "/shared-maps" },
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
        className="md:hidden fixed z-50 bottom-6 right-6 glass-button shadow-lg text-blue-500 dark:text-blue-400 rounded-full p-3 backdrop-blur-md"
        onClick={toggleMobileMenu}
      >
        {isMobileMenuOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </button>

      {/* Sidebar */}
      <aside 
        className={cn(
          "glass-card fixed md:h-full z-40 transition-transform sidebar-transition border-0 backdrop-blur-lg",
          "w-72 md:w-64 rounded-none md:rounded-r-3xl shadow-xl",
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="h-full flex flex-col">
          {/* Logo and Brand */}
          <div className="p-6 border-b border-slate-200/20 dark:border-slate-700/20">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className="glow">
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
                className="md:hidden glass-button p-2 rounded-lg text-slate-600 dark:text-slate-300"
                onClick={toggleMobileMenu}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex-grow p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location === item.href;
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center px-4 py-3 rounded-xl transition-all duration-200 group",
                    isActive 
                      ? "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400" 
                      : "text-slate-600 dark:text-slate-300 hover:bg-white/30 dark:hover:bg-slate-800/30"
                  )}
                >
                  <span className={cn(
                    "mr-3 transition-transform duration-200",
                    isActive 
                      ? "text-blue-500 dark:text-blue-400" 
                      : "text-slate-500 dark:text-slate-400 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:scale-110"
                  )}>
                    {item.icon}
                  </span>
                  <span className="font-medium">{item.label}</span>
                  
                  {isActive && (
                    <div className="ml-auto w-1.5 h-6 bg-blue-500 rounded-full"></div>
                  )}
                </Link>
              );
            })}
          </nav>
          
          {/* User Profile */}
          <div className="p-4 border-t border-slate-200/20 dark:border-slate-700/20 mt-auto">
            <div className="glass-card p-3 rounded-xl flex items-center">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium mr-3 shadow-md">
                {user?.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{user?.username}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email || "User"}</p>
              </div>
              <Button 
                size="icon" 
                className="ml-auto glass-button text-slate-600 dark:text-slate-300 hover:text-red-500 dark:hover:text-red-400 rounded-lg"
                onClick={handleLogout}
                disabled={logoutMutation.isPending}
              >
                {logoutMutation.isPending ? (
                  <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                ) : (
                  <LogOut className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
