import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { CHAR_FRAMES } from "@/lib/timing";

type TerminalTypingProps = {
	text: string;
	startFrame?: number;
	charFrames?: number;
	color?: string;
	cursor?: boolean;
	prefix?: string;
	prefixColor?: string;
};

/** Frame-based typewriter effect — replaces motion-based TypingAnimation */
export const TerminalTyping: React.FC<TerminalTypingProps> = ({
	text,
	startFrame = 0,
	charFrames = CHAR_FRAMES,
	color = "var(--foreground)",
	cursor = true,
	prefix,
	prefixColor = "var(--success)",
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const relFrame = frame - startFrame;

	if (relFrame < 0) return null;

	const totalTypingFrames = text.length * charFrames;
	const charsToShow = Math.floor(
		interpolate(relFrame, [0, totalTypingFrames], [0, text.length], {
			extrapolateRight: "clamp",
		}),
	);

	const displayText = text.substring(0, charsToShow);
	const isTyping = charsToShow < text.length;
	const cursorVisible = cursor && isTyping && Math.floor(relFrame / (fps / 2)) % 2 === 0;

	return (
		<div style={{ display: "flex", whiteSpace: "pre" }}>
			{prefix && (
				<span style={{ color: prefixColor, fontWeight: 700 }}>{prefix}</span>
			)}
			<span style={{ color }}>{displayText}</span>
			{cursorVisible && (
				<span
					style={{
						color: "var(--foreground)",
						opacity: 0.8,
					}}
				>
					▊
				</span>
			)}
		</div>
	);
};
