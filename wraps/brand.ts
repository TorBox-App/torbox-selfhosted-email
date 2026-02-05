import { defineBrand } from "@wraps.dev/email";

export default defineBrand({
  primaryColor: "#5046e5",
  secondaryColor: "#6366f1",
  backgroundColor: "#ffffff",
  textColor: "#1f2937",
  fontFamily: "system-ui, -apple-system, sans-serif",
  buttonStyle: "rounded",
  buttonRadius: "6px",
  companyName: "Wraps",
  companyAddress: "San Francisco, CA",
  logoUrl: "https://wraps.dev/logo.png",
  socialLinks: [
    { platform: "twitter", url: "https://x.com/wraborern" },
    { platform: "github", url: "https://github.com/wraps-team" },
  ],
});
