import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Bell, Settings, Sparkles, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Link } from "wouter";

interface TopbarProps {
  title: string;
  onSearch?: (query: string) => void;
}

export default function Topbar({ title, onSearch }: TopbarProps) {
  const [query, setQuery] = useState("");
  const [hasNotifications, setHasNotifications] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  // Detect scroll position to add glass effect only when scrolled
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(query);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    if (onSearch) {
      onSearch(newQuery);
    }
  };

  return (
    <header 
      className={cn(
        "sticky top-0 z-20 transition-all duration-300",
        isScrolled
          ? "glass-card shadow-lg border-b border-white/10 dark:border-slate-700/20 backdrop-blur-xl"
          : "bg-transparent"
      )}
    >
      <div className="flex justify-between items-center px-6 py-4">
        <div className="flex items-center">
          <h1 
            className={cn(
              "text-lg font-bold transition-all duration-300",
              isScrolled
                ? "text-slate-900 dark:text-white"
                : "glow-text"
            )}
          >
            {title}
            {isScrolled ? null : <Sparkles className="inline-block ml-2 h-4 w-4 text-indigo-500 animate-pulse" />}
          </h1>
        </div>
        
        <div className="flex items-center space-x-2 md:space-x-4">
          <form onSubmit={handleSearch} className="relative hidden sm:block">
            <Input
              type="text"
              placeholder="Search services..."
              className="w-48 pl-8 pr-4 py-1 text-sm glass-input"
              value={query}
              onChange={handleChange}
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          </form>

          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center glass-button rounded-full h-8 px-3 text-sm text-slate-600 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
              <span>All Systems Operational</span>
              <ChevronDown className="ml-1 h-3 w-3" />
            </div>
            
            <ThemeToggle />
            
            <Button
              variant="outline"
              size="icon"
              className={cn(
                "glass-button relative h-8 w-8 rounded-full",
                hasNotifications ? "after:absolute after:top-0 after:right-0 after:h-2 after:w-2 after:rounded-full after:bg-red-500 after:animate-ping" : ""
              )}
              onClick={() => setHasNotifications(false)}
            >
              <Bell className="h-4 w-4" />
            </Button>
            
            <Link href="/settings">
              <Button
                variant="outline"
                size="icon"
                className="glass-button h-8 w-8 rounded-full"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
