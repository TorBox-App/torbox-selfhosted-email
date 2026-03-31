import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";

type StatCardProps = {
	label: string;
	value: number;
	suffix?: string;
	icon: React.ReactNode;
	description: string;
	index: number;
};

const StatCard: React.FC<StatCardProps> = ({
	label,
	value,
	suffix = "",
	icon,
	description,
	index,
}) => {
	const frame = useCurrentFrame();

	const enterDelay = index * 8;
	const opacity = interpolate(frame - enterDelay, [0, 10], [0, 1], {
		extrapolateRight: "clamp",
		extrapolateLeft: "clamp",
	});
	const y = interpolate(frame - enterDelay, [0, 10], [8, 0], {
		extrapolateRight: "clamp",
		extrapolateLeft: "clamp",
	});

	// Count up
	const countStart = enterDelay + 8;
	const currentValue = interpolate(
		frame,
		[countStart, countStart + 40],
		[0, value],
		{ extrapolateRight: "clamp", extrapolateLeft: "clamp" },
	);

	const displayValue = suffix === "%"
		? currentValue.toFixed(1)
		: Math.floor(currentValue).toLocaleString();

	return (
		<div
			style={{
				opacity,
				transform: `translateY(${y}px)`,
				background: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 8,
				padding: "12px 14px",
				display: "flex",
				flexDirection: "column",
				gap: 6,
			}}
		>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<span style={{ fontSize: 10, fontWeight: 500, color: "var(--muted-foreground)", fontFamily: "var(--font-sans)" }}>
					{label}
				</span>
				<div style={{ color: "var(--muted-foreground)", opacity: 0.5 }}>{icon}</div>
			</div>
			<div style={{ fontSize: 22, fontWeight: 700, color: "var(--foreground)", fontFamily: "var(--font-sans)", letterSpacing: "-0.02em", lineHeight: 1 }}>
				{displayValue}{suffix}
			</div>
			<span style={{ fontSize: 9, color: "var(--muted-foreground)", fontFamily: "var(--font-sans)" }}>
				{description}
			</span>
		</div>
	);
};

const MailIcon = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<rect width="20" height="16" x="2" y="4" rx="2" />
		<path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
	</svg>
);

const TrendingUpIcon = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
		<polyline points="16 7 22 7 22 13" />
	</svg>
);

const ActivityIcon = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" />
	</svg>
);

const UsersIcon = () => (
	<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
		<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
		<circle cx="9" cy="7" r="4" />
		<path d="M22 21v-2a4 4 0 0 0-3-3.87" />
		<path d="M16 3.13a4 4 0 0 1 0 7.75" />
	</svg>
);

export const MetricsCountUp: React.FC = () => (
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
				display: "grid",
				gridTemplateColumns: "1fr 1fr",
				gap: 8,
				width: "100%",
			}}
		>
			<StatCard label="Emails Sent" value={12847} icon={<MailIcon />} description="Last 24 hours" index={0} />
			<StatCard label="Delivery Rate" value={99.2} suffix="%" icon={<TrendingUpIcon />} description="12,744 delivered" index={1} />
			<StatCard label="Open Rate" value={42.8} suffix="%" icon={<ActivityIcon />} description="5,494 opened" index={2} />
			<StatCard label="Click Rate" value={8.3} suffix="%" icon={<UsersIcon />} description="1,066 clicked" index={3} />
		</div>
	</AbsoluteFill>
);
