import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/Toaster";
import { ColorSchemeProvider } from "@/lib/color-scheme";
import { RunProgressProvider } from "@/lib/run-progress";
import { ToastProvider } from "@/lib/toast";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ColorSchemeProvider>
      <ToastProvider>
        <RunProgressProvider>
          <App />
          <Toaster />
        </RunProgressProvider>
      </ToastProvider>
    </ColorSchemeProvider>
  </BrowserRouter>,
);
