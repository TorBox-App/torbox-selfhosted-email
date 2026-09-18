"use client";

import { useTheme } from "@wraps/ui/hooks/use-theme";
import * as React from "react";
import { CopyButton } from "@/components/ui/shadcn-io/copy-button";
import {
  Tabs,
  TabsContent,
  TabsContents,
  TabsList,
  type TabsProps,
  TabsTrigger,
  useTabs,
} from "@/components/ui/shadcn-io/tabs";
import { cn } from "@/lib/utils";

// Helper to get resolved theme from theme setting
function useResolvedTheme() {
  const { theme } = useTheme();
  const [resolvedTheme, setResolvedTheme] = React.useState<"light" | "dark">(
    "light"
  );

  React.useEffect(() => {
    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      setResolvedTheme(isDark ? "dark" : "light");

      const handler = (e: MediaQueryListEvent) => {
        setResolvedTheme(e.matches ? "dark" : "light");
      };
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    setResolvedTheme(theme === "dark" ? "dark" : "light");
  }, [theme]);

  return resolvedTheme;
}

/**
 * `card` is the default chrome: rounded, bordered, tinted panel.
 * `flush` drops the panel and matches the homepage comparison table —
 * flat on the section background, mono uppercase labels, brand underline.
 */
type CodeTabsVariant = "card" | "flush";

type CodeTabsProps = {
  codes: Record<string, string>;
  lang?: string;
  themes?: {
    light: string;
    dark: string;
  };
  copyButton?: boolean;
  /** Called when copy is attempted. Return false to prevent copy action. */
  onCopy?: (content: string) => boolean | undefined;
  variant?: CodeTabsVariant;
} & Omit<TabsProps, "children">;

function CodeTabsContent({
  codes,
  lang = "bash",
  themes = {
    light: "github-light",
    dark: "github-dark",
  },
  copyButton = true,
  onCopy,
  variant = "card",
}: {
  codes: Record<string, string>;
  lang?: string;
  themes?: { light: string; dark: string };
  copyButton?: boolean;
  onCopy?: (content: string) => boolean | undefined;
  variant?: CodeTabsVariant;
}) {
  const isFlush = variant === "flush";
  const resolvedTheme = useResolvedTheme();
  const { activeValue } = useTabs();

  const [highlightedCodes, setHighlightedCodes] =
    React.useState<Record<string, string>>(codes); // Start with raw codes for instant rendering

  React.useEffect(() => {
    async function loadHighlightedCode() {
      try {
        const { codeToHtml } = await import("shiki");
        const newHighlightedCodes: Record<string, string> = {};

        for (const [command, val] of Object.entries(codes)) {
          const highlighted = await codeToHtml(val, {
            lang,
            themes: {
              light: themes.light,
              dark: themes.dark,
            },
            defaultColor: resolvedTheme === "dark" ? "dark" : "light",
          });

          newHighlightedCodes[command] = highlighted;
        }

        setHighlightedCodes(newHighlightedCodes);
      } catch (error) {
        console.error("Error highlighting codes", error);
      }
    }
    loadHighlightedCode();
  }, [resolvedTheme, lang, themes.light, themes.dark, codes]);

  return (
    <>
      <TabsList
        activeClassName={cn(
          "rounded-none bg-transparent shadow-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-t-full after:content-['']",
          isFlush ? "after:bg-brand" : "after:bg-black dark:after:bg-white"
        )}
        className={cn(
          "relative h-10 w-full justify-between rounded-none border-b py-0 text-current",
          isFlush
            ? "border-border bg-transparent px-0"
            : "border-border/75 bg-muted px-4 dark:border-border/50"
        )}
        data-slot="install-tabs-list"
      >
        <div className="flex h-full gap-x-3">
          {Object.keys(codes).map((code) => (
            <TabsTrigger
              className={cn(
                "px-0 text-muted-foreground data-[state=active]:text-current",
                isFlush &&
                  "font-medium font-mono text-xs uppercase tracking-widest data-[state=active]:text-foreground"
              )}
              key={code}
              value={code}
            >
              {code}
            </TabsTrigger>
          ))}
        </div>

        {copyButton && (
          <CopyButton
            className={cn(
              "bg-transparent hover:bg-black/5 dark:hover:bg-white/10",
              // The card variant pads the list, so the button pulls back into
              // that padding. Flush has no padding to pull into.
              isFlush ? "me-0" : "-me-2"
            )}
            content={codes[activeValue]}
            onCopy={onCopy}
            size="sm"
            variant="ghost"
          />
        )}
      </TabsList>
      <TabsContents data-slot="install-tabs-contents">
        {Object.entries(codes).map(([code, rawCode]) => (
          <TabsContent
            className={cn(
              "flex w-full items-center overflow-auto text-sm",
              isFlush ? "px-0 py-4" : "p-4"
            )}
            data-slot="install-tabs-content"
            key={code}
            value={code}
          >
            <div className="w-full [&>pre]:m-0 [&>pre]:border-none [&>pre]:bg-transparent! [&>pre]:p-0 [&>pre]:text-[13px] [&>pre]:leading-relaxed [&_.shiki]:bg-transparent! [&_code]:bg-transparent! [&_code]:text-[13px] [&_code]:leading-relaxed">
              {highlightedCodes[code] !== rawCode ? (
                <div
                  dangerouslySetInnerHTML={{ __html: highlightedCodes[code] }}
                />
              ) : (
                <pre>
                  <code>{rawCode}</code>
                </pre>
              )}
            </div>
          </TabsContent>
        ))}
      </TabsContents>
    </>
  );
}

function CodeTabs({
  codes,
  lang = "bash",
  themes = {
    light: "github-light",
    dark: "github-dark",
  },
  className,
  defaultValue,
  value,
  onValueChange,
  copyButton = true,
  onCopy,
  variant = "card",
  ...props
}: CodeTabsProps) {
  const firstKey = React.useMemo(() => Object.keys(codes)[0] ?? "", [codes]);

  // Handle controlled vs uncontrolled properly
  const tabsProps =
    value !== undefined
      ? { value, onValueChange }
      : { defaultValue: defaultValue ?? firstKey };

  return (
    <Tabs
      className={cn(
        "w-full gap-0 overflow-hidden",
        variant === "flush"
          ? "rounded-none border-0 bg-transparent"
          : "rounded-xl border bg-muted/50",
        className
      )}
      data-slot="install-tabs"
      {...tabsProps}
      {...(props as any)}
    >
      <CodeTabsContent
        codes={codes}
        copyButton={copyButton}
        lang={lang}
        onCopy={onCopy}
        themes={themes}
        variant={variant}
      />
    </Tabs>
  );
}

export { CodeTabs, type CodeTabsProps };
