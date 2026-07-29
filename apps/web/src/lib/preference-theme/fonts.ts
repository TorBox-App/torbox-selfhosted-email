/**
 * Self-hosted font registry for the public preference center.
 *
 * Every family is declared with `next/font/google`, the same mechanism as
 * `apps/web/src/lib/fonts.ts`. Next downloads these at BUILD TIME and serves
 * them from our own origin — there is no runtime request to
 * fonts.googleapis.com, no third-party privacy exposure on a subscriber-
 * facing page, and no CSP problem.
 *
 * `preload: false` is deliberate: without it, Next emits a
 * <link rel="preload"> for every declared family on any page that imports
 * this module, which would preload ~14 fonts to use one.
 *
 * `next/font/google` requires a static literal family name at each call
 * site, so this registry is necessarily a hand-written module — that is the
 * intended shape, not a limitation to work around. Do not attempt dynamic
 * font loading.
 */
import {
  DM_Sans,
  Geist,
  Inter,
  Lora,
  Manrope,
  Merriweather,
  Montserrat,
  Open_Sans,
  Outfit,
  Playfair_Display,
  Poppins,
  Prata,
  Roboto,
  Source_Serif_4,
} from "next/font/google";

const inter = Inter({ subsets: ["latin"], display: "swap", preload: false });
const geist = Geist({ subsets: ["latin"], display: "swap", preload: false });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false });
const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const outfit = Outfit({ subsets: ["latin"], display: "swap", preload: false });
const montserrat = Montserrat({
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const poppins = Poppins({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "500", "600", "700"],
});
const openSans = Open_Sans({
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const roboto = Roboto({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "500", "700"],
});
const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  display: "swap",
  preload: false,
});
const lora = Lora({ subsets: ["latin"], display: "swap", preload: false });
const merriweather = Merriweather({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400", "700"],
});
const prata = Prata({
  subsets: ["latin"],
  display: "swap",
  preload: false,
  weight: ["400"],
});

export type PreferenceFontId =
  | "inter"
  | "geist"
  | "dm-sans"
  | "manrope"
  | "outfit"
  | "montserrat"
  | "poppins"
  | "open-sans"
  | "roboto"
  | "playfair-display"
  | "source-serif-4"
  | "lora"
  | "merriweather"
  | "prata";

export type PreferenceFont = {
  id: PreferenceFontId;
  label: string;
  category: "sans" | "serif";
  fontFamily: string;
};

export const PREFERENCE_FONTS: readonly PreferenceFont[] = [
  {
    id: "inter",
    label: "Inter",
    category: "sans",
    fontFamily: inter.style.fontFamily,
  },
  {
    id: "geist",
    label: "Geist",
    category: "sans",
    fontFamily: geist.style.fontFamily,
  },
  {
    id: "dm-sans",
    label: "DM Sans",
    category: "sans",
    fontFamily: dmSans.style.fontFamily,
  },
  {
    id: "manrope",
    label: "Manrope",
    category: "sans",
    fontFamily: manrope.style.fontFamily,
  },
  {
    id: "outfit",
    label: "Outfit",
    category: "sans",
    fontFamily: outfit.style.fontFamily,
  },
  {
    id: "montserrat",
    label: "Montserrat",
    category: "sans",
    fontFamily: montserrat.style.fontFamily,
  },
  {
    id: "poppins",
    label: "Poppins",
    category: "sans",
    fontFamily: poppins.style.fontFamily,
  },
  {
    id: "open-sans",
    label: "Open Sans",
    category: "sans",
    fontFamily: openSans.style.fontFamily,
  },
  {
    id: "roboto",
    label: "Roboto",
    category: "sans",
    fontFamily: roboto.style.fontFamily,
  },
  {
    id: "playfair-display",
    label: "Playfair Display",
    category: "serif",
    fontFamily: playfairDisplay.style.fontFamily,
  },
  {
    id: "source-serif-4",
    label: "Source Serif 4",
    category: "serif",
    fontFamily: sourceSerif4.style.fontFamily,
  },
  {
    id: "lora",
    label: "Lora",
    category: "serif",
    fontFamily: lora.style.fontFamily,
  },
  {
    id: "merriweather",
    label: "Merriweather",
    category: "serif",
    fontFamily: merriweather.style.fontFamily,
  },
  {
    id: "prata",
    label: "Prata",
    category: "serif",
    fontFamily: prata.style.fontFamily,
  },
];

export const DEFAULT_BODY_FONT_ID: PreferenceFontId = "inter";

const PREFERENCE_FONT_MAP = new Map<string, PreferenceFont>(
  PREFERENCE_FONTS.map((font) => [font.id, font])
);

export function getPreferenceFont(
  id: string | null | undefined
): PreferenceFont | null {
  if (!id) {
    return null;
  }
  return PREFERENCE_FONT_MAP.get(id) ?? null;
}
