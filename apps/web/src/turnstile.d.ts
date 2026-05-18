interface TurnstileWidget {
  render: (
    container: Element | string,
    options: {
      sitekey: string;
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
      theme?: "light" | "dark" | "auto";
      size?: "normal" | "compact" | "invisible";
    }
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
}

interface Window {
  turnstile?: TurnstileWidget;
  onloadTurnstileCallback?: () => void;
}
