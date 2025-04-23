import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeToggleProvider } from "./components/theme-provider";

document.title = "Uptime Monitor | Service Mesh Dashboard";

console.log("main.tsx: Starting application");

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    console.error("Root element not found");
  } else {
    console.log("Root element found, rendering App");
    createRoot(rootElement).render(
      <ThemeToggleProvider>
        <App />
      </ThemeToggleProvider>
    );
    console.log("App rendered");
  }
} catch (error) {
  console.error("Error rendering App:", error);
}
