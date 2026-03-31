import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Workflow Builder — AI Design Panel + Canvas with nodes
 * Matches the actual UX: AI chat on left, React Flow canvas on right
 * AI generates the workflow, nodes appear on canvas with connections
 */

type NodeDef = {
	label: string;
	sublabel: string;
	x: number;
	y: number;
	color: string;
	iconPath: string;
};

const NODES: NodeDef[] = [
	{
		label: "When user signs up",
		sublabel: "Event: user.signup",
		x: 30,
		y: 20,
		color: "#eab308", // yellow-500
		iconPath: "M13 2L3 14h9l-1 10 10-12h-9l1-10z",
	},
	{
		label: "Send welcome email",
		sublabel: "Template: welcome-v2",
		x: 30,
		y: 115,
		color: "#3b82f6", // blue-500
		iconPath: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6",
	},
	{
		label: "Wait 2 days",
		sublabel: "48 hours",
		x: 30,
		y: 210,
		color: "#a855f7", // purple-500
		iconPath: "M12 2a10 10 0 100 20 10 10 0 000-20zM12 6v6l4 2",
	},
	{
		label: "Opened email?",
		sublabel: "Check event",
		x: 30,
		y: 305,
		color: "#f97316", // orange-500
		iconPath: "M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5",
	},
];

const WorkflowNode: React.FC<{ node: NodeDef; index: number }> = ({ node, index }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Nodes appear after AI "generates" them
	const enterDelay = 58 + index * 10;
	const scale = spring({
		frame: frame - enterDelay,
		fps,
		config: { damping: 12, stiffness: 200 },
	});
	const opacity = interpolate(frame - enterDelay, [0, 6], [0, 1], {
		extrapolateRight: "clamp",
		extrapolateLeft: "clamp",
	});

	return (
		<div
			style={{
				position: "absolute",
				left: node.x,
				top: node.y,
				opacity,
				transform: `scale(${scale})`,
				transformOrigin: "left center",
			}}
		>
			<div
				style={{
					background: "var(--card)",
					border: "1px solid var(--border)",
					borderRadius: 8,
					padding: "8px 12px",
					display: "flex",
					alignItems: "center",
					gap: 8,
					width: 200,
					boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
				}}
			>
				<div
					style={{
						width: 28,
						height: 28,
						borderRadius: 6,
						background: node.color,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						flexShrink: 0,
					}}
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d={node.iconPath} />
					</svg>
				</div>
				<div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
					<span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)", fontFamily: "var(--font-sans)" }}>{node.label}</span>
					<span style={{ fontSize: 9, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>{node.sublabel}</span>
				</div>
			</div>
		</div>
	);
};

const Edge: React.FC<{ fromY: number; toY: number; x: number; index: number }> = ({ fromY, toY, x, index }) => {
	const frame = useCurrentFrame();
	const enterDelay = 62 + index * 10;
	const progress = interpolate(frame - enterDelay, [0, 10], [0, 1], {
		extrapolateRight: "clamp",
		extrapolateLeft: "clamp",
	});
	if (progress <= 0) return null;
	const cx = x + 100; // center of 200px wide node
	const sy = fromY + 44;
	const ey = sy + (toY - sy) * progress;
	return (
		<line x1={cx} y1={sy} x2={cx} y2={ey} stroke="var(--muted-foreground)" strokeWidth="1.5" opacity={0.4} />
	);
};

export const WorkflowConnect: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// AI prompt typing
	const promptText = "Welcome series for new signups";
	const promptChars = interpolate(frame, [8, 25], [0, promptText.length], {
		extrapolateRight: "clamp",
		extrapolateLeft: "clamp",
	});

	// AI thinking
	const isThinking = frame >= 30 && frame < 55;
	const thinkingDot = Math.floor(frame / 6) % 3;

	// AI response
	const responseVisible = frame >= 55;

	// Apply button
	const applyScale = frame >= 90
		? spring({ frame: frame - 90, fps, config: { damping: 10, stiffness: 250 } })
		: 0;

	const cardScale = spring({ frame, fps, config: { damping: 15, stiffness: 150 } });

	return (
		<AbsoluteFill
			style={{
				background: "var(--background)",
				fontFamily: "var(--font-sans)",
			}}
		>
			<div
				style={{
					position: "absolute",
					inset: 0,
					transform: `scale(${cardScale})`,
					display: "flex",
					overflow: "hidden",
				}}
			>
				{/* Left: AI Design Panel */}
				<div
					style={{
						width: 200,
						borderRight: "1px solid var(--border)",
						background: "var(--card)",
						display: "flex",
						flexDirection: "column",
						fontSize: 11,
						flexShrink: 0,
					}}
				>
					{/* Header */}
					<div style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 5 }}>
						<span style={{ fontSize: 12 }}>✨</span>
						<span style={{ fontWeight: 600, color: "var(--foreground)", fontSize: 11 }}>AI Assistant</span>
					</div>

					{/* Quick prompts (before user types) */}
					{frame < 8 && (
						<div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
							<span style={{ fontSize: 9, color: "var(--muted-foreground)" }}>Quick prompts</span>
							{["Welcome Series", "Cart Abandonment", "Re-engagement"].map((p) => (
								<div key={p} style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid var(--border)", fontSize: 10, color: "var(--muted-foreground)" }}>
									{p}
								</div>
							))}
						</div>
					)}

					{/* Messages */}
					<div style={{ flex: 1, padding: 8, display: "flex", flexDirection: "column", gap: 6, overflow: "hidden" }}>
						{/* User message */}
						{frame >= 8 && (
							<div style={{ alignSelf: "flex-end", maxWidth: "90%" }}>
								<div style={{ padding: "5px 8px", borderRadius: "8px 8px 2px 8px", background: "var(--primary)", color: "var(--primary-foreground)", fontSize: 10, lineHeight: 1.4 }}>
									{promptText.substring(0, Math.floor(promptChars))}
								</div>
							</div>
						)}

						{/* AI thinking */}
						{isThinking && (
							<div style={{ alignSelf: "flex-start" }}>
								<div style={{ padding: "5px 8px", borderRadius: "8px 8px 8px 2px", background: "var(--muted)", color: "var(--muted-foreground)", fontSize: 10 }}>
									{".".repeat(thinkingDot + 1)}
								</div>
							</div>
						)}

						{/* AI response */}
						{responseVisible && (
							<div style={{ alignSelf: "flex-start", maxWidth: "95%" }}>
								<div style={{ padding: "5px 8px", borderRadius: "8px 8px 8px 2px", background: "var(--muted)", fontSize: 10, lineHeight: 1.4, color: "var(--foreground)" }}>
									Built a 4-step welcome series with trigger, email, delay, and open check.
								</div>
							</div>
						)}

						{/* Apply / Discard */}
						{applyScale > 0 && (
							<div style={{ display: "flex", gap: 4, transform: `scale(${applyScale})`, transformOrigin: "left center" }}>
								<div style={{ padding: "3px 10px", fontSize: 9, fontWeight: 600, borderRadius: 4, background: "oklch(0.646 0.222 41.116)", color: "white" }}>Apply</div>
								<div style={{ padding: "3px 10px", fontSize: 9, borderRadius: 4, border: "1px solid var(--border)", color: "var(--muted-foreground)" }}>Discard</div>
							</div>
						)}
					</div>

					{/* Input */}
					<div style={{ padding: "6px 8px", borderTop: "1px solid var(--border)" }}>
						<div style={{ padding: "5px 7px", borderRadius: 5, border: "1px solid var(--border)", fontSize: 9, color: "var(--muted-foreground)" }}>
							Describe your automation...
						</div>
					</div>
				</div>

				{/* Right: Canvas */}
				<div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
					{/* Dot grid */}
					<div
						style={{
							position: "absolute",
							inset: 0,
							backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
							backgroundSize: "15px 15px",
							opacity: 0.5,
						}}
					/>

					{/* Edges */}
					<svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
						{[0, 1, 2].map((i) => (
							<Edge
								key={i}
								fromY={NODES[i]!.y}
								toY={NODES[i + 1]!.y}
								x={NODES[i]!.x}
								index={i}
							/>
						))}
					</svg>

					{/* Nodes */}
					{NODES.map((node, i) => (
						<WorkflowNode key={node.label} node={node} index={i} />
					))}
				</div>
			</div>
		</AbsoluteFill>
	);
};
