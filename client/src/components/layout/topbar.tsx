import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Bell, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

interface TopbarProps {
  title: string;
  onSearch?: (query: string) => void;
}

export default function Topbar({ title, onSearch }: TopbarProps) {
  const [query, setQuery] = useState("");
  const [hasNotifications, setHasNotifications] = useState(true);

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
    <header className="bg-white dark:bg-gray-800 shadow-sm z-20 relative">
      <div className="flex justify-between items-center px-4 py-3">
        <div className="flex items-center">
          <h1 className="text-lg font-medium text-gray-800 dark:text-gray-100">{title}</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <form onSubmit={handleSearch} className="relative">
            <Input
              type="text"
              placeholder="Search services..."
              className="w-48 pl-8 pr-4 py-1 text-sm"
              value={query}
              onChange={handleChange}
            />
            <Search className="absolute left-2.5 top-1.5 h-4 w-4 text-gray-400" />
          </form>
          
          <ThemeToggle />
          
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "relative p-1.5 rounded-full text-gray-500 hover:bg-gray-100 focus:outline-none dark:hover:bg-gray-800 dark:text-gray-300",
              hasNotifications ? "after:absolute after:top-0 after:right-0 after:h-2 after:w-2 after:rounded-full after:bg-red-500" : ""
            )}
            onClick={() => setHasNotifications(false)}
          >
            <Bell className="h-5 w-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="p-1.5 rounded-full text-gray-500 hover:bg-gray-100 focus:outline-none dark:hover:bg-gray-800 dark:text-gray-300"
            onClick={() => window.location.href = "/settings"}
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
