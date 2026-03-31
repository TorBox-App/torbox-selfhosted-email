import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

// Generate realistic-looking email metrics data
const DATA_POINTS = 24;
const generateData = (base: number, variance: number, trend: number) =>
	Array.from({ length: DATA_POINTS }, (_, i) => ({
		x: i,
		y: base + Math.sin(i * 0.5) * variance + i * trend + (Math.random() * variance * 0.3),
	}));

const SENDS = generateData(800, 200, 15);
const DELIVERIES = generateData(780, 180, 14);
const OPENS = generateData(300, 100, 8);

const LINES = [
	{ data: SENDS, color: "var(--foreground)", label: "Sends", opacity: 1 },
	{ data: DELIVERIES, color: "oklch(0.65 0.2 145)", label: "Delivered", opacity: 0.9 },
	{ data: OPENS, color: "oklch(0.68 0.15 250)", label: "Opens", opacity: 0.8 },
] as const;

const CHART_W = 480;
const CHART_H = 200;
const PADDING = { top: 10, right: 20, bottom: 30, left: 50 };

const innerW = CHART_W - PADDING.left - PADDING.right;
const innerH = CHART_H - PADDING.top - PADDING.bottom;

// Find global max for y-axis
const allValues = [...SENDS, ...DELIVERIES, ...OPENS].map((d) => d.y);
const maxY = Math.ceil(Math.max(...allValues) / 200) * 200;

const scaleX = (x: number) => PADDING.left + (x / (DATA_POINTS - 1)) * innerW;
const scaleY = (y: number) => PADDING.top + innerH - (y / maxY) * innerH;

const buildPath = (data: { x: number; y: number }[], pointCount: number) => {
	const points = data.slice(0, pointCount);
	if (points.length === 0) return "";
	return points
		.map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.x)} ${scaleY(p.y)}`)
		.join(" ");
};

export const ChartDraw: React.FC = () => {
	const frame = useCurrentFrame();

	// Animate points drawing from left to right
	const drawProgress = interpolate(frame, [10, 80], [0, DATA_POINTS], {
		extrapolateRight: "clamp",
		extrapolateLeft: "clamp",
	});
	const pointCount = Math.floor(drawProgress);

	// Y-axis labels fade in
	const axisOpacity = interpolate(frame, [0, 10], [0, 1], {
		extrapolateRight: "clamp",
	});

	// Legend fade in
	const legendOpacity = interpolate(frame, [70, 85], [0, 1], {
		extrapolateRight: "clamp",
	});

	const yLabels = [0, maxY / 4, maxY / 2, (maxY * 3) / 4, maxY];

	return (
		<AbsoluteFill
			style={{
				background: "var(--background)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 24,
			}}
		>
			<div
				style={{
					background: "var(--card)",
					border: "1px solid var(--border)",
					borderRadius: 10,
					padding: "20px 24px",
					width: CHART_W + 48,
				}}
			>
				{/* Title */}
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "baseline",
						marginBottom: 16,
					}}
				>
					<span
						style={{
							fontSize: 14,
							fontWeight: 600,
							color: "var(--foreground)",
							fontFamily: "var(--font-sans)",
						}}
					>
						Email Metrics
					</span>
					<span
						style={{
							fontSize: 11,
							color: "var(--muted-foreground)",
							fontFamily: "var(--font-mono)",
						}}
					>
						Last 24 hours
					</span>
				</div>

				{/* Chart */}
				<svg width={CHART_W} height={CHART_H} style={{ overflow: "visible" }}>
					{/* Grid lines */}
					{yLabels.map((val) => (
						<g key={val} opacity={axisOpacity}>
							<line
								x1={PADDING.left}
								y1={scaleY(val)}
								x2={CHART_W - PADDING.right}
								y2={scaleY(val)}
								stroke="var(--border)"
								strokeDasharray="3 3"
							/>
							<text
								x={PADDING.left - 8}
								y={scaleY(val) + 4}
								textAnchor="end"
								fill="var(--muted-foreground)"
								fontSize="10"
								fontFamily="var(--font-mono)"
							>
								{val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
							</text>
						</g>
					))}

					{/* X-axis labels */}
					{[0, 6, 12, 18, 23].map((i) => (
						<text
							key={i}
							x={scaleX(i)}
							y={CHART_H - 4}
							textAnchor="middle"
							fill="var(--muted-foreground)"
							fontSize="10"
							fontFamily="var(--font-mono)"
							opacity={axisOpacity}
						>
							{`${i}:00`}
						</text>
					))}

					{/* Data lines — drawn progressively */}
					{LINES.map((line) => (
						<path
							key={line.label}
							d={buildPath(line.data, pointCount)}
							stroke={line.color}
							strokeWidth="2"
							fill="none"
							opacity={line.opacity}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					))}

					{/* Drawing head dots */}
					{pointCount > 0 &&
						LINES.map((line) => {
							const pt = line.data[Math.min(pointCount - 1, DATA_POINTS - 1)];
							if (!pt) return null;
							return (
								<circle
									key={line.label}
									cx={scaleX(pt.x)}
									cy={scaleY(pt.y)}
									r="3"
									fill={line.color}
									opacity={drawProgress < DATA_POINTS ? 1 : 0}
								/>
							);
						})}
				</svg>

				{/* Legend */}
				<div
					style={{
						display: "flex",
						gap: 16,
						marginTop: 12,
						opacity: legendOpacity,
						justifyContent: "center",
					}}
				>
					{LINES.map((line) => (
						<div
							key={line.label}
							style={{
								display: "flex",
								alignItems: "center",
								gap: 6,
								fontSize: 11,
								color: "var(--muted-foreground)",
								fontFamily: "var(--font-sans)",
							}}
						>
							<div
								style={{
									width: 8,
									height: 8,
									borderRadius: "50%",
									background: line.color,
								}}
							/>
							{line.label}
						</div>
					))}
				</div>
			</div>
		</AbsoluteFill>
	);
};
