import { TerminalLine, TerminalPrompt } from "@/components/terminal";
import { seconds } from "@/lib/timing";
import { useCurrentFrame } from "remotion";

type ProviderPromptProps = {
	selectFrame?: number;
};

/** Scene 2: Clack intro + provider selection */
export const ProviderPrompt: React.FC<ProviderPromptProps> = ({
	selectFrame = seconds(2),
}) => {
	const frame = useCurrentFrame();

	return (
		<>
			{/* Clack intro bar */}
			<TerminalLine startFrame={0}>
				<span style={{ color: "var(--muted-foreground)" }}>│</span>
			</TerminalLine>

			<TerminalLine startFrame={4}>
				<span style={{ color: "var(--info)" }}>◆</span>
				<span style={{ color: "var(--foreground)", marginLeft: 8 }}>
					Wraps Email Infrastructure Setup
				</span>
			</TerminalLine>

			<TerminalLine startFrame={12}>
				<span style={{ color: "var(--muted-foreground)" }}>│</span>
			</TerminalLine>

			{/* Provider selection */}
			<TerminalPrompt
				message="Where is your app hosted?"
				startFrame={18}
				selectFrame={selectFrame}
				selectedIndex={1}
				options={[
					{ label: "AWS (Lambda/ECS/EC2)", hint: "Uses IAM roles automatically" },
					{ label: "Vercel", hint: "Uses OIDC — no credentials needed" },
					{ label: "Railway", hint: "Requires AWS credentials" },
					{ label: "Other", hint: "Will use AWS access keys" },
				]}
			/>

			{/* Validated checks after selection */}
			{frame >= selectFrame + 10 && (
				<TerminalLine startFrame={0}>
					<div style={{ display: "flex", gap: 8 }}>
						<span style={{ color: "var(--success)" }}>✓</span>
						<span style={{ color: "var(--muted-foreground)" }}>
							Connected to AWS account: 123456789012
						</span>
					</div>
				</TerminalLine>
			)}
		</>
	);
};
