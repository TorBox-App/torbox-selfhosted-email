import type { z } from "zod";
import { AbsoluteFill, Sequence } from "remotion";
import { TerminalChrome } from "@/components/terminal";
import type { DeployFlowSchema } from "./DeployFlow.schema";
import { TypingCommand } from "./scenes/TypingCommand";
import { ProviderPrompt } from "./scenes/ProviderPrompt";
import { ConfigSteps } from "./scenes/ConfigSteps";
import { DeployProgress } from "./scenes/DeployProgress";
import { SuccessOutput } from "./scenes/SuccessOutput";
import { seconds } from "@/lib/timing";

export const DeployFlow: React.FC<z.infer<typeof DeployFlowSchema>> = ({
	domain,
	region,
	regionLabel,
}) => {
	// Scene timing (in frames)
	const scene1 = 0; // Typing command
	const scene2 = seconds(2.5); // Provider prompt
	const scene3 = seconds(5.5); // Config steps (region, domain)
	const scene4 = seconds(9); // Deploy progress with spinners
	const scene5 = seconds(14.5); // Success output

	return (
		<AbsoluteFill
			style={{
				background: "var(--background)",
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: "var(--font-mono)",
			}}
		>
			<TerminalChrome title="wraps" width={780} height={480}>
				{/* layout="none" prevents Sequence from wrapping in AbsoluteFill */}
				<Sequence from={scene1} layout="none">
					<TypingCommand />
				</Sequence>

				<Sequence from={scene2} layout="none">
					<ProviderPrompt selectFrame={seconds(2)} />
				</Sequence>

				<Sequence from={scene3} layout="none">
					<ConfigSteps
						domain={domain}
						region={region}
						regionLabel={regionLabel}
					/>
				</Sequence>

				<Sequence from={scene4} layout="none">
					<DeployProgress domain={domain} />
				</Sequence>

				<Sequence from={scene5} layout="none">
					<SuccessOutput domain={domain} region={region} />
				</Sequence>
			</TerminalChrome>
		</AbsoluteFill>
	);
};
