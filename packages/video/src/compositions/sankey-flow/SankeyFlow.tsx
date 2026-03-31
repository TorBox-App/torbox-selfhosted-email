import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

/**
 * Sankey Chart — email delivery funnel
 * Sent → Delivered/Bounced → Opened/Not Opened → Clicked/No Click
 * Draws progressively from left to right
 */

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
	value: number;
	fromY: number;
	toY: number;
};

const TOTAL = 12450;

const NODES: SankeyNode[] = [
	// Column 0: Sent
	{ label: "Sent", value: 12450, x: 0, y: 20, h: 220, color: "hsl(221 83% 53%)", column: 0 },
	// Column 1: Delivery
	{ label: "Delivered", value: 12380, x: 160, y: 20, h: 216, color: "hsl(262 83% 58%)", column: 1 },
	{ label: "Bounced", value: 20, x: 160, y: 242, h: 6, color: "hsl(0 72% 51%)", column: 1 },
	{ label: "Failed", value: 50, x: 160, y: 254, h: 8, color: "hsl(0 84% 60%)", column: 1 },
	// Column 2: Engagement
	{ label: "Opened", value: 4952, x: 320, y: 20, h: 88, color: "hsl(330 81% 60%)", column: 2 },
	{ label: "Not Opened", value: 7426, x: 320, y: 114, h: 130, color: "hsl(215 16% 47%)", column: 2 },
	// Column 3: Clicks
	{ label: "Clicked", value: 1238, x: 480, y: 20, h: 28, color: "hsl(25 95% 53%)", column: 3 },
	{ label: "No Click", value: 3714, x: 480, y: 54, h: 60, color: "hsl(215 16% 57%)", column: 3 },
];

const LINKS: SankeyLink[] = [
	{ from: 0, to: 1, value: 12380, fromY: 20, toY: 20 },
	{ from: 0, to: 2, value: 20, fromY: 236, toY: 242 },
	{ from: 0, to: 3, value: 50, fromY: 238, toY: 254 },
	{ from: 1, to: 4, value: 4952, fromY: 20, toY: 20 },
	{ from: 1, to: 5, value: 7426, fromY: 108, toY: 114 },
	{ from: 4, to: 6, value: 1238, fromY: 20, toY: 20 },
	{ from: 4, to: 7, value: 3714, fromY: 48, toY: 54 },
];

const NODE_W = 14;
const CHART_X = 60;
const CHART_Y = 30;

export const SankeyFlow: React.FC = () => {
	const frame = useCurrentFrame();

	// Progressive reveal by column
	const col0 = interpolate(frame, [5, 15], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
	const col1 = interpolate(frame, [20, 30], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
	const col2 = interpolate(frame, [35, 45], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
	const col3 = interpolate(frame, [50, 60], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
	const colOpacity = [col0, col1, col2, col3];

	// Links follow their target column
	const linkOpacity = (targetCol: number) => {
		const starts = [5, 20, 35, 50];
		const start = starts[targetCol] ?? 50;
		return interpolate(frame, [start, start + 15], [0, 0.3], {
			extrapolateRight: "clamp",
			extrapolateLeft: "clamp",
		});
	};

	return (
		<AbsoluteFill
			style={{
				background: "var(--background)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 16,
				fontFamily: "var(--font-sans)",
			}}
		>
			<div
				style={{
					background: "var(--card)",
					border: "1px solid var(--border)",
					borderRadius: 10,
					padding: "16px 20px",
					width: "100%",
					maxWidth: 620,
				}}
			>
				{/* Title */}
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
					<span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>Delivery Funnel</span>
					<span style={{ fontSize: 11, color: "var(--muted-foreground)", fontFamily: "var(--font-mono)" }}>
						{TOTAL.toLocaleString()} sent
					</span>
				</div>

				{/* Sankey SVG */}
				<svg width="100%" viewBox="0 0 560 280" style={{ overflow: "visible" }}>
					{/* Links */}
					{LINKS.map((link, i) => {
						const fromNode = NODES[link.from]!;
						const toNode = NODES[link.to]!;
						const opacity = linkOpacity(toNode.column);

						const sx = CHART_X + fromNode.x + NODE_W;
						const sy = CHART_Y + link.fromY;
						const ex = CHART_X + toNode.x;
						const ey = CHART_Y + link.toY;
						const sh = Math.max(2, (link.value / TOTAL) * 220);
						const eh = Math.max(2, toNode.h);

						const mx = (sx + ex) / 2;

						return (
							<path
								key={i}
								d={`M${sx},${sy} C${mx},${sy} ${mx},${ey} ${ex},${ey} L${ex},${ey + eh} C${mx},${ey + eh} ${mx},${sy + sh} ${sx},${sy + sh} Z`}
								fill={fromNode.color}
								opacity={opacity}
							/>
						);
					})}

					{/* Nodes */}
					{NODES.map((node) => {
						const opacity = colOpacity[node.column] ?? 0;
						const scaleY = colOpacity[node.column] ?? 0;

						return (
							<g key={node.label} opacity={opacity}>
								<rect
									x={CHART_X + node.x}
									y={CHART_Y + node.y}
									width={NODE_W}
									height={node.h * scaleY}
									rx={2}
									fill={node.color}
								/>
								{/* Label */}
								{scaleY > 0.5 && (
									<text
										x={node.column <= 1 ? CHART_X + node.x + NODE_W + 6 : CHART_X + node.x - 6}
										y={CHART_Y + node.y + Math.min(node.h * scaleY, node.h) / 2 + 4}
										textAnchor={node.column <= 1 ? "start" : "end"}
										fontSize="11"
										fontWeight="600"
										fill="var(--foreground)"
										fontFamily="var(--font-sans)"
									>
										{node.label}
									</text>
								)}
								{/* Count */}
								{scaleY > 0.5 && (
									<text
										x={node.column <= 1 ? CHART_X + node.x + NODE_W + 6 : CHART_X + node.x - 6}
										y={CHART_Y + node.y + Math.min(node.h * scaleY, node.h) / 2 + 16}
										textAnchor={node.column <= 1 ? "start" : "end"}
										fontSize="10"
										fill="var(--muted-foreground)"
										fontFamily="var(--font-mono)"
									>
										{node.value.toLocaleString()}
									</text>
								)}
							</g>
						);
					})}
				</svg>
			</div>
		</AbsoluteFill>
	);
};
