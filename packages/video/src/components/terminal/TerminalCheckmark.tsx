import { spring, useCurrentFrame, useVideoConfig } from "remotion";

type TerminalCheckmarkProps = {
	text: string;
	startFrame?: number;
	color?: string;
	icon?: string;
};

/** Green checkmark with spring entrance animation */
export const TerminalCheckmark: React.FC<TerminalCheckmarkProps> = ({
	text,
	startFrame = 0,
	color = "var(--success)",
	icon = "✓",
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();
	const relFrame = frame - startFrame;

	if (relFrame < 0) return null;

	const scale = spring({
		frame: relFrame,
		fps,
		config: { damping: 12, stiffness: 200 },
	});

	return (
		<div style={{ display: "flex", gap: 8, whiteSpace: "pre" }}>
			<span
				style={{
					color,
					transform: `scale(${scale})`,
					display: "inline-block",
				}}
			>
				{icon}
			</span>
			<span style={{ color: "var(--foreground)" }}>{text}</span>
		</div>
	);
};
