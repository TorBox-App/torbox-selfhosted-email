import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type EventItem = {
	type: string;
	color: string;
	iconPath: string;
	time: string;
	detail?: string;
};

const EVENTS: EventItem[] = [
	{
		type: "Sent",
		color: "oklch(0.708 0 0)",
		iconPath: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
		time: "10:42:03 AM",
	},
	{
		type: "Delivered",
		color: "oklch(0.65 0.2 145)",
		iconPath: "M20 6L9 17l-5-5",
		time: "10:42:04 AM",
		detail: "250 OK",
	},
	{
		type: "Opened",
		color: "oklch(0.68 0.15 250)",
		iconPath: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 9a3 3 0 100 6 3 3 0 000-6z",
		time: "10:43:17 AM",
		detail: "Chrome · macOS",
	},
	{
		type: "Clicked",
		color: "oklch(0.627 0.265 303.9)",
		iconPath: "M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1",
		time: "10:43:24 AM",
		detail: "https://app.acme.dev/welcome",
	},
];

const EventRow: React.FC<{ event: EventItem; index: number }> = ({ event, index }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const enterDelay = 15 + index * 18;
	const progress = spring({
		frame: frame - enterDelay,
		fps,
		config: { damping: 14, stiffness: 160 },
	});
	const opacity = interpolate(frame - enterDelay, [0, 6], [0, 1], {
		extrapolateRight: "clamp",
		extrapolateLeft: "clamp",
	});

	const isLast = index === EVENTS.length - 1;

	return (
		<div
			style={{
				opacity,
				transform: `translateX(${(1 - progress) * 20}px)`,
				display: "flex",
				gap: 16,
				position: "relative",
			}}
		>
			{/* Timeline line + dot */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					width: 32,
					flexShrink: 0,
				}}
			>
				{/* Dot */}
				<div
					style={{
						width: 28,
						height: 28,
						borderRadius: "50%",
						background: event.color,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						transform: `scale(${progress})`,
						flexShrink: 0,
					}}
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 24 24"
						fill="none"
						stroke="white"
						strokeWidth="2.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d={event.iconPath} />
					</svg>
				</div>
				{/* Connecting line */}
				{!isLast && (
					<div
						style={{
							width: 2,
							flex: 1,
							minHeight: 24,
							background: "var(--border)",
						}}
					/>
				)}
			</div>

			{/* Content */}
			<div style={{ paddingBottom: isLast ? 0 : 20, paddingTop: 2 }}>
				<div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
					<span
						style={{
							fontSize: 15,
							fontWeight: 600,
							color: "var(--foreground)",
							fontFamily: "var(--font-sans)",
						}}
					>
						{event.type}
					</span>
					<span
						style={{
							fontSize: 12,
							color: "var(--muted-foreground)",
							fontFamily: "var(--font-mono)",
						}}
					>
						{event.time}
					</span>
				</div>
				{event.detail && (
					<div
						style={{
							fontSize: 12,
							color: "var(--muted-foreground)",
							fontFamily: "var(--font-mono)",
							marginTop: 2,
						}}
					>
						{event.detail}
					</div>
				)}
			</div>
		</div>
	);
};

export const EventTimeline: React.FC = () => (
	<AbsoluteFill
		style={{
			background: "var(--background)",
			display: "flex",
			alignItems: "center",
			justifyContent: "center",
			padding: 32,
		}}
	>
		<div
			style={{
				background: "var(--card)",
				border: "1px solid var(--border)",
				borderRadius: 10,
				padding: "24px 28px",
				width: "100%",
				maxWidth: 400,
			}}
		>
			{/* Header */}
			<div
				style={{
					fontSize: 14,
					fontWeight: 600,
					color: "var(--foreground)",
					fontFamily: "var(--font-sans)",
					marginBottom: 20,
				}}
			>
				Event Timeline
			</div>

			{/* Events */}
			{EVENTS.map((event, i) => (
				<EventRow key={event.type} event={event} index={i} />
			))}
		</div>
	</AbsoluteFill>
);
