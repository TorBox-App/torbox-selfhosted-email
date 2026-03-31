import { interpolate, useCurrentFrame } from "remotion";
import { CLACK } from "@/lib/timing";

type Option = {
	label: string;
	hint?: string;
	selected?: boolean;
};

type TerminalPromptProps = {
	message: string;
	options: Option[];
	startFrame?: number;
	/** Frame at which the selection is confirmed */
	selectFrame?: number;
	selectedIndex?: number;
};

/** Clack-style select prompt with animated cursor and selection */
export const TerminalPrompt: React.FC<TerminalPromptProps> = ({
	message,
	options,
	startFrame = 0,
	selectFrame,
	selectedIndex = 0,
}) => {
	const frame = useCurrentFrame();
	const relFrame = frame - startFrame;

	if (relFrame < 0) return null;

	const isSelected = selectFrame !== undefined && frame >= selectFrame;

	// Fade in the entire prompt
	const opacity = interpolate(relFrame, [0, 6], [0, 1], {
		extrapolateRight: "clamp",
	});

	if (isSelected) {
		// After selection: show only the selected option with bar
		const selected = options[selectedIndex];
		return (
			<div style={{ opacity, display: "flex", flexDirection: "column", gap: 0 }}>
				<div style={{ display: "flex", gap: 8 }}>
					<span style={{ color: "var(--success)" }}>{CLACK.corner}</span>
					<span style={{ color: "var(--foreground)" }}>{message}</span>
				</div>
				<div style={{ display: "flex", gap: 8 }}>
					<span style={{ color: "var(--muted-foreground)" }}>{CLACK.bar}</span>
					<span style={{ color: "var(--muted-foreground)" }}>
						{selected?.label}
					</span>
					{selected?.hint && (
						<span style={{ color: "var(--muted-foreground)", opacity: 0.6 }}>
							({selected.hint})
						</span>
					)}
				</div>
			</div>
		);
	}

	return (
		<div style={{ opacity, display: "flex", flexDirection: "column", gap: 0 }}>
			{/* Question line */}
			<div style={{ display: "flex", gap: 8 }}>
				<span style={{ color: "var(--info)" }}>{CLACK.cornerActive}</span>
				<span style={{ color: "var(--foreground)" }}>{message}</span>
			</div>

			{/* Options */}
			{options.map((opt, i) => {
				const isActive = i === selectedIndex;
				// Stagger option appearance
				const optDelay = 4 + i * 3;
				const optOpacity = interpolate(relFrame, [optDelay, optDelay + 4], [0, 1], {
					extrapolateRight: "clamp",
				});

				return (
					<div
						key={opt.label}
						style={{
							display: "flex",
							gap: 8,
							opacity: optOpacity,
						}}
					>
						<span style={{ color: "var(--muted-foreground)" }}>{CLACK.bar}</span>
						<span style={{ color: isActive ? "var(--info)" : "var(--muted-foreground)" }}>
							{isActive ? CLACK.radio : CLACK.radioInactive}
						</span>
						<span
							style={{
								color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
							}}
						>
							{opt.label}
						</span>
						{opt.hint && (
							<span style={{ color: "var(--muted-foreground)", opacity: 0.5 }}>
								{opt.hint}
							</span>
						)}
					</div>
				);
			})}
		</div>
	);
};
