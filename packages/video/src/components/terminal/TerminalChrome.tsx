import type React from "react";

type TerminalChromeProps = {
	children: React.ReactNode;
	title?: string;
	width?: number;
	height?: number;
	/** Pixels to scroll the content upward */
	scrollY?: number;
};

/** Terminal window frame with traffic-light dots — matches website Terminal component */
export const TerminalChrome: React.FC<TerminalChromeProps> = ({
	children,
	title = "Terminal",
	width = 720,
	height = 440,
	scrollY = 0,
}) => (
	<div
		style={{
			width,
			height,
			borderRadius: 12,
			border: "1px solid var(--border)",
			background: "var(--card)",
			display: "flex",
			flexDirection: "column",
			overflow: "hidden",
			fontFamily: "var(--font-mono)",
		}}
	>
		{/* Title bar */}
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 8,
				padding: "12px 16px",
				borderBottom: "1px solid var(--border)",
				flexShrink: 0,
			}}
		>
			<div style={{ display: "flex", gap: 6 }}>
				<div
					style={{
						width: 10,
						height: 10,
						borderRadius: "50%",
						background: "#ef4444",
					}}
				/>
				<div
					style={{
						width: 10,
						height: 10,
						borderRadius: "50%",
						background: "#eab308",
					}}
				/>
				<div
					style={{
						width: 10,
						height: 10,
						borderRadius: "50%",
						background: "#22c55e",
					}}
				/>
			</div>
			<span
				style={{
					fontSize: 12,
					color: "var(--muted-foreground)",
					marginLeft: 8,
				}}
			>
				{title}
			</span>
		</div>

		{/* Terminal body — clips overflow, scrolls via translateY */}
		<div
			style={{
				flex: 1,
				overflow: "hidden",
				position: "relative",
			}}
		>
			<div
				style={{
					padding: 16,
					display: "flex",
					flexDirection: "column",
					gap: 2,
					fontSize: 13,
					lineHeight: 1.6,
					color: "var(--foreground)",
					transform: `translateY(-${scrollY}px)`,
				}}
			>
				{children}
			</div>
		</div>
	</div>
);
