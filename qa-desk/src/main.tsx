import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthProvider";
import { Toaster } from "@/components/Toaster";
import { ColorSchemeProvider } from "@/lib/color-scheme";
import { RunProgressProvider } from "@/lib/run-progress";
import { RunCompleteListener } from "@/lib/run-complete-listener";
import { ConfirmProvider } from "@/lib/confirm";
import { ToastProvider } from "@/lib/toast";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <ColorSchemeProvider>
        <ToastProvider>
          <ConfirmProvider>
            <RunProgressProvider>
              <App />
              <RunCompleteListener />
              <Toaster />
            </RunProgressProvider>
          </ConfirmProvider>
        </ToastProvider>
      </ColorSchemeProvider>
    </AuthProvider>
  </BrowserRouter>,
);
