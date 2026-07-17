import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "@/components/Toaster";
import { ColorSchemeProvider } from "@/lib/color-scheme";
import { RunProgressProvider } from "@/lib/run-progress";
import { RunCompleteListener } from "@/lib/run-complete-listener";
import { ToastProvider } from "@/lib/toast";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <ColorSchemeProvider>
      <ToastProvider>
        <RunProgressProvider>
          <App />
          <RunCompleteListener />
          <Toaster />
        </RunProgressProvider>
      </ToastProvider>
    </ColorSchemeProvider>
  </BrowserRouter>,
);
