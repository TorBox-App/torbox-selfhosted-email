import { interpolate, useCurrentFrame } from "remotion";
import { CLACK } from "@/lib/timing";

type TerminalNoteProps = {
	title: string;
	children: React.ReactNode;
	startFrame?: number;
	titleColor?: string;
};

/** Clack-style note/box with title and content */
export const TerminalNote: React.FC<TerminalNoteProps> = ({
	title,
	children,
	startFrame = 0,
	titleColor = "var(--success)",
}) => {
	const frame = useCurrentFrame();
	const relFrame = frame - startFrame;

	if (relFrame < 0) return null;

	const opacity = interpolate(relFrame, [0, 8], [0, 1], {
		extrapolateRight: "clamp",
	});

	return (
		<div style={{ opacity, display: "flex", flexDirection: "column", gap: 0 }}>
			<div style={{ display: "flex", gap: 8 }}>
				<span style={{ color: titleColor }}>{CLACK.corner}</span>
				<span style={{ color: titleColor, fontWeight: 700 }}>{title}</span>
			</div>
			<div style={{ display: "flex", gap: 8 }}>
				<span style={{ color: "var(--muted-foreground)" }}>{CLACK.bar}</span>
				<div style={{ color: "var(--foreground)" }}>{children}</div>
			</div>
			<div style={{ display: "flex", gap: 8 }}>
				<span style={{ color: "var(--muted-foreground)" }}>{CLACK.barEnd}</span>
			</div>
		</div>
	);
};
