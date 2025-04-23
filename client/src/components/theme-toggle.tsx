import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useThemeToggle } from "@/components/theme-provider"

export function ThemeToggle() {
  const { theme, setTheme } = useThemeToggle()

  return (
    <Button
      variant="ghost"
      size="icon"
      className="rounded-full"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      {theme === "dark" ? (
        <Sun className="h-5 w-5 text-yellow-400" />
      ) : (
        <Moon className="h-5 w-5 text-gray-500" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}