import { TerminalSpinner, TerminalCheckmark, TerminalLine } from "@/components/terminal";
import { seconds, CLACK } from "@/lib/timing";
import { useCurrentFrame } from "remotion";

type DeployProgressProps = {
	domain: string;
};

const RESOURCES = [
	{ name: "SES configuration set", delay: 0.6 },
	{ name: "SES email identity", delay: 1.2 },
	{ name: "DKIM signing keys", delay: 1.8 },
	{ name: "DynamoDB events table", delay: 2.4 },
	{ name: "Lambda event processor", delay: 3.0 },
	{ name: "IAM cross-account role", delay: 3.6 },
	{ name: "EventBridge rules", delay: 4.2 },
] as const;

/** Scene 4: Deploy spinner resolving to checkmarked resources */
export const DeployProgress: React.FC<DeployProgressProps> = ({ domain }) => {
	const frame = useCurrentFrame();

	// Main spinner runs for first 0.5s then resources start appearing
	const mainSpinnerResolve = seconds(4.5);

	return (
		<>
			{/* Separator */}
			<TerminalLine startFrame={0}>
				<span style={{ color: "var(--muted-foreground)" }}>{CLACK.bar}</span>
			</TerminalLine>

			{/* Main deploy spinner */}
			<TerminalSpinner
				text="Deploying infrastructure..."
				startFrame={seconds(0.2)}
				resolveFrame={mainSpinnerResolve}
				color="var(--warning)"
			/>

			{/* Individual resource checkmarks */}
			{RESOURCES.map((resource) => {
				const checkFrame = seconds(resource.delay) + seconds(0.5);
				return (
					frame >= checkFrame && (
						<TerminalCheckmark
							key={resource.name}
							text={resource.name}
							startFrame={0}
							icon="+"
						/>
					)
				);
			})}

			{/* DNS auto-configured note */}
			{frame >= seconds(4.8) && (
				<>
					<TerminalLine startFrame={0}>
						<span style={{ color: "var(--muted-foreground)" }}>{CLACK.bar}</span>
					</TerminalLine>
					<TerminalCheckmark
						text={`DNS records auto-configured for ${domain}`}
						startFrame={0}
						icon="✓"
					/>
				</>
			)}
		</>
	);
};
