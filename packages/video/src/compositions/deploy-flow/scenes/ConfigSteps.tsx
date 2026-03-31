import { TerminalPrompt, TerminalLine } from "@/components/terminal";
import { seconds, CLACK } from "@/lib/timing";
import { useCurrentFrame } from "remotion";

type ConfigStepsProps = {
	domain: string;
	region: string;
	regionLabel: string;
};

/** Scene 3: Region select, domain input, volume select — condensed */
export const ConfigSteps: React.FC<ConfigStepsProps> = ({
	domain,
	region,
	regionLabel,
}) => {
	const frame = useCurrentFrame();

	// Region already selected
	const regionDone = 0;
	// Domain input
	const domainStart = seconds(0.8);
	const domainDone = seconds(1.8);
	// Volume select
	const volumeStart = seconds(2.2);
	const volumeDone = seconds(3);

	return (
		<>
			{/* Region — already resolved */}
			<TerminalLine startFrame={regionDone}>
				<div style={{ display: "flex", gap: 8 }}>
					<span style={{ color: "var(--success)" }}>{CLACK.corner}</span>
					<span style={{ color: "var(--foreground)" }}>Select AWS region</span>
				</div>
			</TerminalLine>
			<TerminalLine startFrame={regionDone + 3}>
				<div style={{ display: "flex", gap: 8 }}>
					<span style={{ color: "var(--muted-foreground)" }}>{CLACK.bar}</span>
					<span style={{ color: "var(--muted-foreground)" }}>
						{regionLabel}
					</span>
					<span style={{ color: "var(--muted-foreground)", opacity: 0.5 }}>
						({region})
					</span>
				</div>
			</TerminalLine>

			{/* Domain input */}
			<TerminalLine startFrame={domainStart}>
				<div style={{ display: "flex", gap: 8 }}>
					<span style={{ color: frame >= domainDone ? "var(--success)" : "var(--info)" }}>
						{frame >= domainDone ? CLACK.corner : CLACK.cornerActive}
					</span>
					<span style={{ color: "var(--foreground)" }}>Domain to verify</span>
				</div>
			</TerminalLine>
			{frame >= domainStart + 6 && (
				<TerminalLine startFrame={0}>
					<div style={{ display: "flex", gap: 8 }}>
						<span style={{ color: "var(--muted-foreground)" }}>{CLACK.bar}</span>
						<span style={{ color: frame >= domainDone ? "var(--muted-foreground)" : "var(--foreground)" }}>
							{domain}
						</span>
					</div>
				</TerminalLine>
			)}

			{/* Volume — already resolved */}
			{frame >= volumeStart && (
				<>
					<TerminalLine startFrame={0}>
						<div style={{ display: "flex", gap: 8 }}>
							<span style={{ color: frame >= volumeDone ? "var(--success)" : "var(--info)" }}>
								{frame >= volumeDone ? CLACK.corner : CLACK.cornerActive}
							</span>
							<span style={{ color: "var(--foreground)" }}>Estimated monthly volume</span>
						</div>
					</TerminalLine>
					<TerminalLine startFrame={0}>
						<div style={{ display: "flex", gap: 8 }}>
							<span style={{ color: "var(--muted-foreground)" }}>{CLACK.bar}</span>
							<span style={{ color: "var(--muted-foreground)" }}>
								1k-10k emails/month
							</span>
							<span style={{ color: "var(--muted-foreground)", opacity: 0.5 }}>
								Side Project
							</span>
						</div>
					</TerminalLine>
				</>
			)}

			{/* Deploy confirmation */}
			{frame >= volumeDone + seconds(0.3) && (
				<TerminalLine startFrame={0}>
					<div style={{ display: "flex", gap: 8 }}>
						<span style={{ color: "var(--success)" }}>{CLACK.corner}</span>
						<span style={{ color: "var(--foreground)" }}>
							Deploy infrastructure to your AWS account?
						</span>
						<span style={{ color: "var(--success)" }}>Yes</span>
					</div>
				</TerminalLine>
			)}
		</>
	);
};
