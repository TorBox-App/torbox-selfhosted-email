import * as React from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { CdnFiles } from "@/components/CdnFiles";
import { CdnMetrics } from "@/components/CdnMetrics";
import { CdnSettings } from "@/components/CdnSettings";
import { EmailDetail } from "@/components/EmailDetail";
import { EmailLogs } from "@/components/EmailLogs";
import { EmailMetrics } from "@/components/EmailMetrics";
import { EmailSettings } from "@/components/EmailSettings";
import { SMSDetail } from "@/components/SMSDetail";
import { SMSLogs } from "@/components/SMSLogs";
import { SMSMetrics } from "@/components/SMSMetrics";
import { SMSSettings } from "@/components/SMSSettings";
import { ThemeProvider } from "@/components/theme-provider";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";

function AppContent() {
  const location = useLocation();
  const [tokenExtracted, setTokenExtracted] = React.useState(false);

  // Extract and store auth token from URL params on mount
  React.useEffect(() => {
    let token = sessionStorage.getItem("wraps-auth-token");

    if (!token) {
      const params = new URLSearchParams(window.location.search);
      token = params.get("token");

      if (token) {
        sessionStorage.setItem("wraps-auth-token", token);
      }
    }
    setTokenExtracted(true);
  }, []);

  // Clear sidebar cookie on mount to ensure it starts expanded
  React.useEffect(() => {
    document.cookie = "sidebar_state=; path=/; max-age=0";
  }, []);

  const getBreadcrumb = () => {
    // Handle dynamic email detail route
    if (
      location.pathname.startsWith("/email/") &&
      location.pathname !== "/email/metrics" &&
      location.pathname !== "/email/settings"
    ) {
      return "Email Details";
    }

    // Handle dynamic SMS detail route
    if (
      location.pathname.startsWith("/sms/") &&
      location.pathname !== "/sms/metrics" &&
      location.pathname !== "/sms/settings"
    ) {
      return "SMS Details";
    }

    // Handle dynamic storage detail route
    if (
      location.pathname.startsWith("/cdn/") &&
      location.pathname !== "/cdn/metrics" &&
      location.pathname !== "/cdn/settings"
    ) {
      return "File Details";
    }

    switch (location.pathname) {
      case "/":
      case "/email":
        return "Emails";
      case "/email/metrics":
        return "Email Metrics";
      case "/email/settings":
        return "Email Settings";
      case "/sms":
        return "SMS Messages";
      case "/sms/metrics":
        return "SMS Metrics";
      case "/sms/settings":
        return "SMS Settings";
      case "/cdn":
        return "CDN";
      case "/cdn/metrics":
        return "CDN Metrics";
      case "/cdn/settings":
        return "CDN Settings";
      default:
        return "Emails";
    }
  };

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 flex shrink-0 items-center gap-2 border-b bg-background p-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            className="mr-2 data-[orientation=vertical]:h-4"
            orientation="vertical"
          />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>{getBreadcrumb()}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <div className="flex flex-1 flex-col gap-6 p-6">
          {tokenExtracted ? (
            <Routes>
              <Route element={<Navigate replace to="/email" />} path="/" />
              <Route element={<EmailLogs />} path="/email" />
              <Route element={<EmailDetail />} path="/email/:id" />
              <Route element={<EmailMetrics />} path="/email/metrics" />
              <Route element={<EmailSettings />} path="/email/settings" />
              <Route element={<SMSLogs />} path="/sms" />
              <Route element={<SMSDetail />} path="/sms/:id" />
              <Route element={<SMSMetrics />} path="/sms/metrics" />
              <Route element={<SMSSettings />} path="/sms/settings" />
              <Route element={<CdnFiles />} path="/cdn" />
              <Route element={<CdnMetrics />} path="/cdn/metrics" />
              <Route element={<CdnSettings />} path="/cdn/settings" />
            </Routes>
          ) : (
            <div className="flex items-center justify-center p-8">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function Page() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="console-ui-theme">
      <BrowserRouter>
        <AppContent />
        <Toaster />
      </BrowserRouter>
    </ThemeProvider>
  );
}
