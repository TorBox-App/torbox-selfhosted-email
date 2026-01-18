import type { Metadata } from "next";
import TelemetryPageContent from "./page-content";

export const metadata: Metadata = {
  title: "Telemetry",
  description: "Learn about Wraps CLI telemetry and how to opt out.",
  openGraph: {
    title: "Telemetry | Wraps",
    description: "Learn about Wraps CLI telemetry and how to opt out.",
    type: "website",
    url: "https://wraps.dev/docs/telemetry",
  },
  twitter: {
    title: "Telemetry | Wraps",
    description: "Learn about Wraps CLI telemetry and how to opt out.",
  },
};

export default function TelemetryPage() {
  return <TelemetryPageContent />;
}
