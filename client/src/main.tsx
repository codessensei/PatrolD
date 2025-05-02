import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

document.title = "PatrolD - Advanced Service Monitoring";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(<App />);
