import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

document.title = "Uptime Monitor | Service Mesh Dashboard";

createRoot(document.getElementById("root")!).render(<App />);
