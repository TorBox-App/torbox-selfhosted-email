import { interpolate, useCurrentFrame } from "remotion";
import { SPINNER_CHARS, SPINNER_CYCLE } from "@/lib/timing";

type TerminalSpinnerProps = {
	text: string;
	startFrame?: number;
	/** Frame at which spinner resolves to a checkmark */
	resolveFrame?: number;
	color?: string;
};

/** Animated spinner that cycles through characters, then resolves to checkmark */
export const TerminalSpinner: React.FC<TerminalSpinnerProps> = ({
	text,
	startFrame = 0,
	resolveFrame,
	color = "var(--info)",
}) => {
	const frame = useCurrentFrame();
	const relFrame = frame - startFrame;

	if (relFrame < 0) return null;

	const isResolved = resolveFrame !== undefined && frame >= resolveFrame;

	if (isResolved) {
		const resolveRel = frame - resolveFrame;
		const scale = interpolate(resolveRel, [0, 6], [0.5, 1], {
			extrapolateRight: "clamp",
		});
		const opacity = interpolate(resolveRel, [0, 4], [0, 1], {
			extrapolateRight: "clamp",
		});

		return (
			<div style={{ display: "flex", gap: 8, whiteSpace: "pre" }}>
				<span
					style={{
						color: "var(--success)",
						transform: `scale(${scale})`,
						display: "inline-block",
						opacity,
					}}
				>
					✓
				</span>
				<span style={{ color: "var(--muted-foreground)" }}>{text}</span>
			</div>
		);
	}

	const charIndex = Math.floor(relFrame / SPINNER_CYCLE) % SPINNER_CHARS.length;
	const char = SPINNER_CHARS[charIndex];

	return (
		<div style={{ display: "flex", gap: 8, whiteSpace: "pre" }}>
			<span style={{ color }}>{char}</span>
			<span style={{ color: "var(--foreground)" }}>{text}</span>
		</div>
	);
};
