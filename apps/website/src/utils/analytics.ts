import posthog from "posthog-js";

/**
 * Analytics utility for Google Tag Manager and PostHog integration
 * Uses environment variables to conditionally load analytics in production
 */

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

export const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "";
export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
export const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Initialize PostHog analytics
 * Only loads PostHog if NEXT_PUBLIC_POSTHOG_KEY is set AND in production mode
 */
export const initPostHog = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  if (!POSTHOG_KEY) {
    console.log(
      "PostHog not initialized - NEXT_PUBLIC_POSTHOG_KEY environment variable not set"
    );
    return;
  }

  if (!IS_PRODUCTION) {
    console.log("PostHog not initialized - running in development mode");
    return;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // We manually track pageviews
    capture_pageleave: true,
    persistence: "localStorage",
  });

  console.log("PostHog initialized successfully");
};

/**
 * Initialize Google Tag Manager
 * Only loads GTM if NEXT_PUBLIC_GTM_ID environment variable is set AND in production mode
 */
export const initGTM = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  if (!GTM_ID) {
    console.log(
      "GTM not initialized - NEXT_PUBLIC_GTM_ID environment variable not set"
    );
    return;
  }

  if (!IS_PRODUCTION) {
    console.log("GTM not initialized - running in development mode");
    return;
  }

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || [];

  // GTM script injection
  const gtmScript = document.createElement("script");
  gtmScript.innerHTML = `
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${GTM_ID}');
  `;
  document.head.appendChild(gtmScript);

  // GTM noscript fallback
  const noscript = document.createElement("noscript");
  noscript.innerHTML = `
    <iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}"
    height="0" width="0" style="display:none;visibility:hidden"></iframe>
  `;
  document.body.insertBefore(noscript, document.body.firstChild);

  console.log("GTM initialized successfully");
};

/**
 * Check if PostHog is initialized and ready
 */
const isPostHogReady = (): boolean => {
  return !!(
    POSTHOG_KEY &&
    IS_PRODUCTION &&
    typeof posthog?.capture === "function"
  );
};

/**
 * Track custom events
 * @param eventName - The event name
 * @param parameters - Event parameters
 */
export const trackEvent = (
  eventName: string,
  parameters?: Record<string, unknown>
): void => {
  if (typeof window === "undefined" || !IS_PRODUCTION) {
    return;
  }

  // Send to GTM if configured
  if (GTM_ID) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      ...parameters,
    });
  }

  // Send to PostHog if initialized
  if (isPostHogReady()) {
    posthog.capture(eventName, parameters);
  }
};

/**
 * Track page views (useful for SPA route changes)
 * @param path - The page path
 * @param title - Optional page title
 */
export const trackPageView = (path: string, title?: string): void => {
  if (typeof window === "undefined" || !IS_PRODUCTION) {
    return;
  }

  const pageTitle = title || document.title;

  // Send to GTM if configured
  if (GTM_ID) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: "page_view",
      page_path: path,
      page_title: pageTitle,
    });
  }

  // Send to PostHog if initialized
  if (isPostHogReady()) {
    posthog.capture("$pageview", {
      page_path: path,
      page_title: pageTitle,
    });
  }
};
