import { Analytics } from "@vercel/analytics/react";
import { PostHogProvider } from "posthog-js/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

const posthogKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const posthogHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {posthogKey ? (
      <PostHogProvider
        apiKey={posthogKey}
        options={{
          api_host: posthogHost,
          ui_host: "https://us.posthog.com",
          defaults: "2025-05-24",
          capture_exceptions: true,
          cross_subdomain_cookie: true,
          debug: import.meta.env.MODE === "development",
        }}
      >
        <App />
      </PostHogProvider>
    ) : (
      <App />
    )}
    <Analytics framework="vite" />
  </StrictMode>
);
