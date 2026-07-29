/**
 * Canonical, closed list of shadcn token names the public preference center
 * may be themed with. Nothing outside this list may ever be stored or
 * emitted — see validate.ts / parse.ts / serialize.ts.
 *
 * Any token NOT in this list is safe to drop on parse: unset tokens simply
 * fall through to the app's own `:root` values (globals.css), so an org
 * theme is always a partial override layered on a working base.
 */
export const THEME_TOKENS = [
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "destructive",
  "destructive-foreground",
  "success",
  "success-foreground",
  "warning",
  "warning-foreground",
  "border",
  "input",
  "ring",
  "radius",
] as const;

export type ThemeToken = (typeof THEME_TOKENS)[number];

export const COLOR_TOKENS = THEME_TOKENS.filter(
  (token) => token !== "radius"
) as Exclude<ThemeToken, "radius">[];

export const THEME_TOKEN_SET: ReadonlySet<string> = new Set(THEME_TOKENS);

export const COLOR_TOKEN_SET: ReadonlySet<string> = new Set(COLOR_TOKENS);
