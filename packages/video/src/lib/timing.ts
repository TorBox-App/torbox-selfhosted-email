export const FPS = 30;

/** Convert seconds to frame count */
export const seconds = (s: number) => Math.round(s * FPS);

/** Typing speed: frames per character */
export const CHAR_FRAMES = 2; // ~60ms at 30fps

/** Standard delays */
export const LINE_DELAY = seconds(0.3);
export const SPINNER_CYCLE = 4; // frames per spinner character

/** Spinner characters matching Clack's ora spinner */
export const SPINNER_CHARS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** Clack box-drawing characters */
export const CLACK = {
	barStart: "┌",
	bar: "│",
	barEnd: "└",
	corner: "◆",
	cornerActive: "◇",
	radio: "●",
	radioInactive: "○",
	check: "◻",
	checkActive: "◼",
	step: "◆",
	stepActive: "◇",
	stepError: "▲",
} as const;
