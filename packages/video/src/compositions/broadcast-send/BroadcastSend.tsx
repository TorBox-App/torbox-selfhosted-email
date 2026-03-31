import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Broadcast Send + Sankey Funnel — the full lifecycle
 * Send button → confirm → progress bar → completed → Sankey chart draws in
 */

// Sankey data
type SankeyNode = {
	label: string;
	value: number;
	x: number;
	y: number;
	h: number;
	color: string;
	column: number;
};

type SankeyLink = {
	from: number;
	to: number;
	fromY: number;
	toY: number;
	fromH: number;
};

const NODES: SankeyNode[] = [
	{ label: "Sent", value: 5432, x: 0, y: 10, h: 130, color: "hsl(221 83% 53%)", column: 0 },
	{ label: "Delivered", value: 5401, x: 130, y: 10, h: 128, color: "hsl(262 83% 58%)", column: 1 },
	{ label: "Bounced", value: 31, x: 130, y: 143, h: 4, color: "hsl(0 72% 51%)", column: 1 },
	{ label: "Opened", value: 2160, x: 260, y: 10, h: 52, color: "hsl(330 81% 60%)", column: 2 },
	{ label: "Not Opened", value: 3241, x: 260, y: 68, h: 78, color: "hsl(215 16% 47%)", column: 2 },
	{ label: "Clicked", value: 540, x: 390, y: 10, h: 16, color: "hsl(25 95% 53%)", column: 3 },
	{ label: "No Click", value: 1620, x: 390, y: 32, h: 38, color: "hsl(215 16% 57%)", column: 3 },
];

const LINKS: SankeyLink[] = [
	{ from: 0, to: 1, fromY: 10, toY: 10, fromH: 128 },
	{ from: 0, to: 2, fromY: 138, toY: 143, fromH: 4 },
	{ from: 1, to: 3, fromY: 10, toY: 10, fromH: 52 },
	{ from: 1, to: 4, fromY: 62, toY: 68, fromH: 78 },
	{ from: 3, to: 5, fromY: 10, toY: 10, fromH: 16 },
	{ from: 3, to: 6, fromY: 26, toY: 32, fromH: 38 },
];

const NODE_W = 12;
const CX = 40;
const CY = 10;

export const BroadcastSend: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Phase 1: Send card
	const cardEnter = 0;
	const confirmAppear = 25;
	const confirmClick = 40;
	const progressStart = 48;
	const progressEnd = 80;
	const completeBadge = 85;
	// Phase 2: Sankey draws in
	const sankeyStart = 95;

	const cardScale = spring({ frame, fps, config: { damping: 14, stiffness: 160 } });

	// Confirm dialog
	const showDialog = frame >= confirmAppear && frame < confirmClick;
	const dialogScale = spring({ frame: frame - confirmAppear, fps, config: { damping: 14, stiffness: 180 } });
	const dialogOpacity = interpolate(frame, [confirmAppear, confirmAppear + 6], [0, 1], {
		extrapolateRight: "clamp", extrapolateLeft: "clamp",
	});

	// Progress
	const progress = interpolate(frame, [progressStart, progressEnd], [0, 100], {
		extrapolateRight: "clamp", extrapolateLeft: "clamp",
	});
	const processed = Math.floor((progress / 100) * 5432);
	const showProgress = frame >= progressStart;
	const isComplete = frame >= completeBadge;

	const completeScale = frame >= completeBadge
		? spring({ frame: frame - completeBadge, fps, config: { damping: 10, stiffness: 250 } })
		: 0;

	// Sankey column reveals
	const sankeyCol = (col: number) =>
		interpolate(frame, [sankeyStart + col * 10, sankeyStart + col * 10 + 12], [0, 1], {
			extrapolateRight: "clamp", extrapolateLeft: "clamp",
		});
	const linkOpacity = (targetCol: number) =>
		interpolate(frame, [sankeyStart + targetCol * 10, sankeyStart + targetCol * 10 + 15], [0, 0.3], {
			extrapolateRight: "clamp", extrapolateLeft: "clamp",
		});

	// Card shrinks up to make room for sankey
	const cardShrink = interpolate(frame, [sankeyStart - 5, sankeyStart + 5], [1, 0.85], {
		extrapolateRight: "clamp", extrapolateLeft: "clamp",
	});
	const sankeyOpacity = interpolate(frame, [sankeyStart - 2, sankeyStart + 8], [0, 1], {
		extrapolateRight: "clamp", extrapolateLeft: "clamp",
	});

	return (
		<AbsoluteFill
			style={{
				background: "var(--background)",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: 16,
				gap: 10,
				fontFamily: "var(--font-sans)",
			}}
		>
			{/* Broadcast card */}
			<div
				style={{
					transform: `scale(${cardScale * cardShrink})`,
					transformOrigin: "top center",
					width: "100%",
					maxWidth: 480,
					position: "relative",
				}}
			>
				<div
					style={{
						background: "var(--card)",
						border: "1px solid var(--border)",
						borderRadius: 10,
						padding: "14px 18px",
						display: "flex",
						flexDirection: "column",
						gap: 12,
					}}
				>
					{/* Header */}
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
						<div>
							<div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Product Launch</div>
							<div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 1 }}>New feature announcement · launch-announce-v2</div>
						</div>
						{isComplete ? (
							<div style={{ transform: `scale(${completeScale})`, padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 500, background: "oklch(0.65 0.2 145 / 12%)", color: "oklch(0.65 0.2 145)" }}>
								Completed
							</div>
						) : showProgress ? (
							<div style={{ padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 500, background: "oklch(0.8 0.18 55 / 12%)", color: "oklch(0.8 0.18 55)" }}>
								Sending
							</div>
						) : (
							<div style={{ padding: "2px 8px", borderRadius: 9999, fontSize: 10, fontWeight: 500, background: "var(--muted)", color: "var(--muted-foreground)" }}>Draft</div>
						)}
					</div>

					{/* Progress or Send button */}
					{showProgress ? (
						<div>
							<div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
								<span style={{ color: "var(--muted-foreground)" }}>{processed.toLocaleString()} / 5,432</span>
								<span style={{ color: "var(--foreground)", fontWeight: 500, fontFamily: "var(--font-mono)" }}>{Math.floor(progress)}%</span>
							</div>
							<div style={{ height: 3, borderRadius: 2, background: "var(--muted)", overflow: "hidden" }}>
								<div style={{ height: "100%", width: `${progress}%`, borderRadius: 2, background: isComplete ? "oklch(0.65 0.2 145)" : "oklch(0.646 0.222 41.116)" }} />
							</div>
						</div>
					) : (
						<div style={{ padding: "8px 0", borderRadius: 7, background: "oklch(0.646 0.222 41.116)", color: "white", fontSize: 12, fontWeight: 600, textAlign: "center" }}>
							Send to 5,432 contacts
						</div>
					)}
				</div>

				{/* Confirm dialog */}
				{showDialog && (
					<div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "oklch(0 0 0 / 50%)", borderRadius: 10, opacity: dialogOpacity }}>
						<div style={{ transform: `scale(${dialogScale})`, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, padding: 16, width: 280, display: "flex", flexDirection: "column", gap: 10 }}>
							<div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Confirm send</div>
							<div style={{ fontSize: 11, color: "var(--muted-foreground)", lineHeight: 1.5 }}>
								Send emails to <strong style={{ color: "var(--foreground)" }}>5,432</strong> contacts? This cannot be undone.
							</div>
							<div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
								<div style={{ padding: "5px 12px", borderRadius: 5, border: "1px solid var(--border)", fontSize: 11, color: "var(--muted-foreground)" }}>Cancel</div>
								<div style={{ padding: "5px 12px", borderRadius: 5, background: "oklch(0.646 0.222 41.116)", color: "white", fontSize: 11, fontWeight: 600 }}>Send now</div>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Sankey funnel — appears after completion */}
			{frame >= sankeyStart - 5 && (
				<div
					style={{
						opacity: sankeyOpacity,
						width: "100%",
						maxWidth: 520,
						background: "var(--card)",
						border: "1px solid var(--border)",
						borderRadius: 10,
						padding: "10px 14px",
					}}
				>
					<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
						<span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>Delivery Funnel</span>
						<span style={{ fontSize: 10, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>5,432 sent</span>
					</div>

					<svg width="100%" viewBox="0 0 460 160" style={{ overflow: "visible" }}>
						{/* Links */}
						{LINKS.map((link, i) => {
							const fromNode = NODES[link.from]!;
							const toNode = NODES[link.to]!;
							const op = linkOpacity(toNode.column);
							const sx = CX + fromNode.x + NODE_W;
							const sy = CY + link.fromY;
							const ex = CX + toNode.x;
							const ey = CY + link.toY;
							const sh = Math.max(2, link.fromH);
							const eh = Math.max(2, toNode.h);
							const mx = (sx + ex) / 2;
							return (
								<path
									key={i}
									d={`M${sx},${sy} C${mx},${sy} ${mx},${ey} ${ex},${ey} L${ex},${ey + eh} C${mx},${ey + eh} ${mx},${sy + sh} ${sx},${sy + sh} Z`}
									fill={fromNode.color}
									opacity={op}
								/>
							);
						})}

						{/* Nodes */}
						{NODES.map((node) => {
							const col = sankeyCol(node.column);
							return (
								<g key={node.label} opacity={col}>
									<rect x={CX + node.x} y={CY + node.y} width={NODE_W} height={node.h * col} rx={2} fill={node.color} />
									{col > 0.5 && (
										<>
											<text
												x={node.column <= 1 ? CX + node.x + NODE_W + 4 : CX + node.x - 4}
												y={CY + node.y + Math.min(node.h * col, node.h) / 2 + 3}
												textAnchor={node.column <= 1 ? "start" : "end"}
												fontSize="9"
												fontWeight="600"
												fill="var(--foreground)"
												fontFamily="var(--font-sans)"
											>
												{node.label} {node.value.toLocaleString()}
											</text>
										</>
									)}
								</g>
							);
						})}
					</svg>
				</div>
			)}
		</AbsoluteFill>
	);
};
