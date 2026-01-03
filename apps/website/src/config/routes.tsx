import { lazy } from "react";

// Lazy load components for better performance
const Landing = lazy(() => import("@/app/landing/page"));
const Calculator = lazy(() => import("@/app/calculator/page"));
const WhyWraps = lazy(() => import("@/app/why-wraps/page"));
const Sms = lazy(() => import("@/app/sms/page"));
const Docs = lazy(() => import("@/app/docs/page"));
const QuickstartDocs = lazy(() => import("@/app/docs/quickstart/page"));
const QuickstartEmailDocs = lazy(
  () => import("@/app/docs/quickstart/email/page")
);
const QuickstartSmsDocs = lazy(() => import("@/app/docs/quickstart/sms/page"));
const QuickstartPlatformDocs = lazy(
  () => import("@/app/docs/quickstart/platform/page")
);
const SDKReferenceDocs = lazy(() => import("@/app/docs/sdk-reference/page"));
const ClientSDKReferenceDocs = lazy(
  () => import("@/app/docs/client-sdk-reference/page")
);
const SMSSDKReferenceDocs = lazy(
  () => import("@/app/docs/sms-sdk-reference/page")
);
const CLIReferenceDocs = lazy(() => import("@/app/docs/cli-reference/page"));
const GuidesDocs = lazy(() => import("@/app/docs/guides/page"));
const ProductionAccessGuide = lazy(
  () => import("@/app/docs/guides/production-access/page")
);
const DomainVerificationGuide = lazy(
  () => import("@/app/docs/guides/domain-verification/page")
);
const AWSSetupGuide = lazy(
  () => import("@/app/docs/guides/aws-setup/page")
);
const AWSSetupQuickGuide = lazy(
  () => import("@/app/docs/guides/aws-setup/quick/page")
);
const AWSSetupFullGuide = lazy(
  () => import("@/app/docs/guides/aws-setup/full/page")
);
const AWSSetupTroubleshootingGuide = lazy(
  () => import("@/app/docs/guides/aws-setup/troubleshooting/page")
);
const Privacy = lazy(() => import("@/app/privacy/page"));
const Terms = lazy(() => import("@/app/terms/page"));
const NotFound = lazy(() => import("@/app/not-found/page"));

export type RouteConfig = {
  path: string;
  element: React.ReactNode;
  children?: RouteConfig[];
};

export const routes: RouteConfig[] = [
  // Default route - Landing page
  {
    path: "/",
    element: <Landing />,
  },

  // Cost Calculator
  {
    path: "/calculator",
    element: <Calculator />,
  },

  // Why Wraps (for internal champions)
  {
    path: "/why-wraps",
    element: <WhyWraps />,
  },

  // SMS Coming Soon
  {
    path: "/sms",
    element: <Sms />,
  },

  // Documentation
  {
    path: "/docs",
    element: <Docs />,
  },
  {
    path: "/docs/quickstart",
    element: <QuickstartDocs />,
  },
  {
    path: "/docs/quickstart/email",
    element: <QuickstartEmailDocs />,
  },
  {
    path: "/docs/quickstart/sms",
    element: <QuickstartSmsDocs />,
  },
  {
    path: "/docs/quickstart/platform",
    element: <QuickstartPlatformDocs />,
  },
  {
    path: "/docs/sdk-reference",
    element: <SDKReferenceDocs />,
  },
  {
    path: "/docs/client-sdk-reference",
    element: <ClientSDKReferenceDocs />,
  },
  {
    path: "/docs/sms-sdk-reference",
    element: <SMSSDKReferenceDocs />,
  },
  {
    path: "/docs/cli-reference",
    element: <CLIReferenceDocs />,
  },
  {
    path: "/docs/guides",
    element: <GuidesDocs />,
  },
  {
    path: "/docs/guides/production-access",
    element: <ProductionAccessGuide />,
  },
  {
    path: "/docs/guides/domain-verification",
    element: <DomainVerificationGuide />,
  },
  {
    path: "/docs/guides/aws-setup",
    element: <AWSSetupGuide />,
  },
  {
    path: "/docs/guides/aws-setup/quick",
    element: <AWSSetupQuickGuide />,
  },
  {
    path: "/docs/guides/aws-setup/full",
    element: <AWSSetupFullGuide />,
  },
  {
    path: "/docs/guides/aws-setup/troubleshooting",
    element: <AWSSetupTroubleshootingGuide />,
  },

  // Legal pages
  {
    path: "/privacy",
    element: <Privacy />,
  },
  {
    path: "/terms",
    element: <Terms />,
  },

  // Catch-all route for 404
  {
    path: "*",
    element: <NotFound />,
  },
];
