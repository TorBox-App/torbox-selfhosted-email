import { TerminalLine, TerminalNote } from "@/components/terminal";
import { seconds, CLACK } from "@/lib/timing";
import { useCurrentFrame } from "remotion";

type SuccessOutputProps = {
	domain: string;
	region: string;
};

/** Scene 5: Success outro with quick-start code */
export const SuccessOutput: React.FC<SuccessOutputProps> = ({
	domain,
	region,
}) => {
	const frame = useCurrentFrame();

	const roleArn = `arn:aws:iam::123456789012:role/wraps-email-${region}`;

	return (
		<>
			{/* Success bar */}
			<TerminalLine startFrame={0}>
				<div style={{ display: "flex", gap: 8 }}>
					<span style={{ color: "var(--success)" }}>{CLACK.barEnd}</span>
					<span style={{ color: "var(--success)", fontWeight: 700 }}>
						Email infrastructure deployed successfully!
					</span>
				</div>
			</TerminalLine>

			{/* Quick start code */}
			{frame >= seconds(0.6) && (
				<TerminalLine startFrame={0}>
					<div
						style={{
							marginTop: 8,
							padding: "10px 12px",
							background: "var(--background)",
							border: "1px solid var(--border)",
							borderRadius: 6,
							display: "flex",
							flexDirection: "column",
							gap: 2,
							fontSize: 12,
						}}
					>
						<span style={{ color: "var(--muted-foreground)" }}>
							// Quick start — send your first email
						</span>
						<span>
							<span style={{ color: "var(--info)" }}>import</span>
							<span style={{ color: "var(--foreground)" }}> {"{ Wraps }"} </span>
							<span style={{ color: "var(--info)" }}>from</span>
							<span style={{ color: "var(--success)" }}> &apos;@wraps.dev/email&apos;</span>
						</span>
						<span style={{ height: 4 }} />
						<span>
							<span style={{ color: "var(--info)" }}>await</span>
							<span style={{ color: "var(--foreground)" }}> wraps.emails.</span>
							<span style={{ color: "var(--warning)" }}>send</span>
							<span style={{ color: "var(--foreground)" }}>{"({"}</span>
						</span>
						<span style={{ paddingLeft: 16 }}>
							<span style={{ color: "var(--foreground)" }}>from: </span>
							<span style={{ color: "var(--success)" }}>
								&apos;hello@{domain}&apos;
							</span>
							<span style={{ color: "var(--foreground)" }}>,</span>
						</span>
						<span style={{ paddingLeft: 16 }}>
							<span style={{ color: "var(--foreground)" }}>to: </span>
							<span style={{ color: "var(--success)" }}>
								&apos;user@example.com&apos;
							</span>
							<span style={{ color: "var(--foreground)" }}>,</span>
						</span>
						<span style={{ paddingLeft: 16 }}>
							<span style={{ color: "var(--foreground)" }}>subject: </span>
							<span style={{ color: "var(--success)" }}>
								&apos;Hello from Wraps!&apos;
							</span>
						</span>
						<span style={{ color: "var(--foreground)" }}>{"})"}</span>
					</div>
				</TerminalLine>
			)}

			{/* Dashboard link */}
			{frame >= seconds(1.4) && (
				<TerminalLine startFrame={0}>
					<div style={{ marginTop: 4, display: "flex", gap: 8 }}>
						<span style={{ color: "var(--muted-foreground)" }}>
							View dashboard →
						</span>
						<span style={{ color: "var(--info)", textDecoration: "underline" }}>
							https://app.wraps.dev
						</span>
					</div>
				</TerminalLine>
			)}
		</>
	);
};
