import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

/**
 * Contact Segment — filter chips appear, count animates down
 * Shows audience targeting: add filters, watch count narrow
 */

type FilterChip = {
	field: string;
	op: string;
	value: string;
	color: string;
};

const FILTERS: FilterChip[] = [
	{ field: "plan", op: "is", value: "growth", color: "oklch(0.627 0.265 303.9)" },
	{ field: "signed_up", op: ">", value: "7 days ago", color: "oklch(0.68 0.15 250)" },
	{ field: "last_email", op: "not in", value: "30 days", color: "oklch(0.646 0.222 41.116)" },
];

const COUNT_STAGES = [12450, 3891, 1247, 847];

export const ContactSegment: React.FC = () => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const cardScale = spring({ frame, fps, config: { damping: 14, stiffness: 160 } });

	// Each filter chip appears in sequence
	const chipDelays = [15, 40, 65];
	const countTransitions = [
		{ start: 20, end: 35 },  // after filter 1
		{ start: 45, end: 58 },  // after filter 2
		{ start: 70, end: 82 },  // after filter 3
	];

	// Calculate current count
	let currentCount = COUNT_STAGES[0]!;
	for (let i = 0; i < countTransitions.length; i++) {
		const t = countTransitions[i]!;
		const progress = interpolate(frame, [t.start, t.end], [0, 1], {
			extrapolateRight: "clamp",
			extrapolateLeft: "clamp",
		});
		currentCount = COUNT_STAGES[i]! + (COUNT_STAGES[i + 1]! - COUNT_STAGES[i]!) * progress;
	}

	return (
		<AbsoluteFill
			style={{
				background: "var(--background)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				padding: 20,
				fontFamily: "var(--font-sans)",
			}}
		>
			<div
				style={{
					transform: `scale(${cardScale})`,
					width: "100%",
					maxWidth: 420,
					background: "var(--card)",
					border: "1px solid var(--border)",
					borderRadius: 10,
					padding: 20,
					display: "flex",
					flexDirection: "column",
					gap: 16,
				}}
			>
				{/* Header */}
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
					<div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>Segment Builder</div>
					<div
						style={{
							padding: "3px 10px",
							borderRadius: 9999,
							fontSize: 11,
							fontWeight: 500,
							background: "var(--muted)",
							color: "var(--muted-foreground)",
						}}
					>
						Active Growth Users
					</div>
				</div>

				{/* Filter chips */}
				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					<div style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 500 }}>Filters</div>
					<div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
						{FILTERS.map((filter, i) => {
							const delay = chipDelays[i]!;
							const chipScale = spring({
								frame: frame - delay,
								fps,
								config: { damping: 12, stiffness: 220 },
							});
							const chipOpacity = interpolate(frame - delay, [0, 6], [0, 1], {
								extrapolateRight: "clamp",
								extrapolateLeft: "clamp",
							});

							return (
								<div
									key={filter.field}
									style={{
										opacity: chipOpacity,
										transform: `scale(${chipScale})`,
										display: "flex",
										alignItems: "center",
										gap: 4,
										padding: "4px 10px",
										borderRadius: 6,
										border: "1px solid var(--border)",
										background: "var(--background)",
										fontSize: 11,
									}}
								>
									<span style={{ color: filter.color, fontWeight: 600 }}>{filter.field}</span>
									<span style={{ color: "var(--muted-foreground)" }}>{filter.op}</span>
									<span style={{ color: "var(--foreground)", fontFamily: "var(--font-mono)", fontSize: 10 }}>{filter.value}</span>
								</div>
							);
						})}
					</div>
				</div>

				{/* Divider */}
				<div style={{ height: 1, background: "var(--border)" }} />

				{/* Contact count */}
				<div style={{ display: "flex", alignItems: "center", gap: 12 }}>
					{/* Icon */}
					<div
						style={{
							width: 40,
							height: 40,
							borderRadius: 8,
							background: "oklch(0.646 0.222 41.116 / 10%)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="oklch(0.646 0.222 41.116)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
							<circle cx="9" cy="7" r="4" />
							<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
							<path d="M16 3.13a4 4 0 0 1 0 7.75" />
						</svg>
					</div>
					<div>
						<div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>Matching contacts</div>
						<div
							style={{
								fontSize: 28,
								fontWeight: 700,
								color: "var(--foreground)",
								fontFamily: "var(--font-mono)",
								letterSpacing: "-0.02em",
								lineHeight: 1.1,
							}}
						>
							{Math.floor(currentCount).toLocaleString()}
						</div>
					</div>
				</div>

				{/* Sample contacts preview */}
				{frame >= 85 && (
					<div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11 }}>
						<div style={{ color: "var(--muted-foreground)", fontSize: 10 }}>Sample matches</div>
						{["sarah@acme.co", "james@startup.io", "chen@bigco.com"].map((email, i) => {
							const rowOpacity = interpolate(frame - 85, [i * 4, i * 4 + 6], [0, 1], {
								extrapolateRight: "clamp",
								extrapolateLeft: "clamp",
							});
							return (
								<div
									key={email}
									style={{
										opacity: rowOpacity,
										display: "flex",
										justifyContent: "space-between",
										padding: "4px 8px",
										borderRadius: 4,
										background: "var(--background)",
										fontFamily: "var(--font-mono)",
										fontSize: 10,
										color: "var(--muted-foreground)",
									}}
								>
									<span>{email}</span>
									<span style={{ color: "oklch(0.65 0.2 145)" }}>growth</span>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</AbsoluteFill>
	);
};
