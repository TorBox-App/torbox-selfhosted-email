import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

type EmailRow = {
	to: string;
	subject: string;
	status: string;
	statusColor: string;
	statusBg: string;
	time: string;
};

const EMAILS: EmailRow[] = [
	{
		to: "sarah@acme.co",
		subject: "Welcome to Acme",
		status: "Delivered",
		statusColor: "oklch(0.65 0.2 145)",
		statusBg: "oklch(0.65 0.2 145 / 12%)",
		time: "2s ago",
	},
	{
		to: "james@startup.io",
		subject: "Your invoice is ready",
		status: "Opened",
		statusColor: "oklch(0.68 0.15 250)",
		statusBg: "oklch(0.68 0.15 250 / 12%)",
		time: "5s ago",
	},
	{
		to: "maria@corp.dev",
		subject: "Password reset request",
		status: "Clicked",
		statusColor: "oklch(0.627 0.265 303.9)",
		statusBg: "oklch(0.627 0.265 303.9 / 12%)",
		time: "12s ago",
	},
	{
		to: "alex@team.com",
		subject: "Weekly digest",
		status: "Delivered",
		statusColor: "oklch(0.65 0.2 145)",
		statusBg: "oklch(0.65 0.2 145 / 12%)",
		time: "18s ago",
	},
	{
		to: "bounce@invalid.xyz",
		subject: "Account verification",
		status: "Bounced",
		statusColor: "oklch(0.8 0.18 55)",
		statusBg: "oklch(0.8 0.18 55 / 12%)",
		time: "25s ago",
	},
	{
		to: "chen@bigco.com",
		subject: "New feature announcement",
		status: "Delivered",
		statusColor: "oklch(0.65 0.2 145)",
		statusBg: "oklch(0.65 0.2 145 / 12%)",
		time: "31s ago",
	},
];

const Row: React.FC<{ email: EmailRow; index: number }> = ({ email, index }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const enterDelay = 10 + index * 12;
	const slideX = spring({
		frame: frame - enterDelay,
		fps,
		config: { damping: 16, stiffness: 140 },
	});
	const opacity = interpolate(frame - enterDelay, [0, 6], [0, 1], {
		extrapolateRight: "clamp",
		extrapolateLeft: "clamp",
	});

	// Badge pop-in — slightly after row
	const badgeDelay = enterDelay + 8;
	const badgeScale = spring({
		frame: frame - badgeDelay,
		fps,
		config: { damping: 10, stiffness: 250 },
	});

	return (
		<div
			style={{
				opacity,
				transform: `translateY(${(1 - slideX) * 12}px)`,
				display: "grid",
				gridTemplateColumns: "140px 1fr 80px 60px",
				alignItems: "center",
				gap: 12,
				padding: "10px 16px",
				borderBottom: "1px solid var(--border)",
				fontSize: 13,
			}}
		>
			{/* To */}
			<span
				style={{
					color: "var(--foreground)",
					fontFamily: "var(--font-mono)",
					fontSize: 12,
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				{email.to}
			</span>

			{/* Subject */}
			<span
				style={{
					color: "var(--muted-foreground)",
					fontFamily: "var(--font-sans)",
					overflow: "hidden",
					textOverflow: "ellipsis",
					whiteSpace: "nowrap",
				}}
			>
				{email.subject}
			</span>

			{/* Status badge */}
			<div style={{ display: "flex", justifyContent: "center" }}>
				<span
					style={{
						transform: `scale(${badgeScale})`,
						display: "inline-block",
						fontSize: 11,
						fontWeight: 500,
						fontFamily: "var(--font-sans)",
						padding: "2px 8px",
						borderRadius: 9999,
						color: email.statusColor,
						background: email.statusBg,
						whiteSpace: "nowrap",
					}}
				>
					{email.status}
				</span>
			</div>

			{/* Time */}
			<span
				style={{
					color: "var(--muted-foreground)",
					fontSize: 11,
					fontFamily: "var(--font-mono)",
					textAlign: "right",
				}}
			>
				{email.time}
			</span>
		</div>
	);
};

export const StatusBadgeFlow: React.FC = () => (
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
				overflow: "hidden",
				width: "100%",
				maxWidth: 540,
			}}
		>
			{/* Table header */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "140px 1fr 80px 60px",
					gap: 12,
					padding: "10px 16px",
					borderBottom: "1px solid var(--border)",
					fontSize: 11,
					fontWeight: 600,
					color: "var(--muted-foreground)",
					fontFamily: "var(--font-sans)",
					textTransform: "uppercase",
					letterSpacing: "0.05em",
				}}
			>
				<span>To</span>
				<span>Subject</span>
				<span style={{ textAlign: "center" }}>Status</span>
				<span style={{ textAlign: "right" }}>Sent</span>
			</div>

			{/* Rows */}
			{EMAILS.map((email, i) => (
				<Row key={email.to} email={email} index={i} />
			))}
		</div>
	</AbsoluteFill>
);
