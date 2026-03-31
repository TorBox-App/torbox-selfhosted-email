import { Composition, Folder } from "remotion";
import { DeployFlow } from "./compositions/deploy-flow/DeployFlow";
import { DeployFlowSchema } from "./compositions/deploy-flow/DeployFlow.schema";
import { MetricsCountUp } from "./compositions/metrics-count-up/MetricsCountUp";
import { EventTimeline } from "./compositions/event-timeline/EventTimeline";
import { WorkflowConnect } from "./compositions/workflow-connect/WorkflowConnect";
import { StatusBadgeFlow } from "./compositions/status-badge-flow/StatusBadgeFlow";
import { TemplateEdit } from "./compositions/template-edit/TemplateEdit";
import { BroadcastSend } from "./compositions/broadcast-send/BroadcastSend";
import { ContactSegment } from "./compositions/contact-segment/ContactSegment";
import { seconds } from "./lib/timing";
import "./index.css";

/*
 * Composition sizes match the bento grid layout:
 *
 * Large cards (2x2): ~680x480 — AI Templates, AI Workflows
 * Small cards (1x1): ~340x280 — Timeline, Metrics, Segments, Logs
 * Full-width (3x1): ~1020x420 — Broadcasts + Sankey
 */
export const RemotionRoot: React.FC = () => (
	<>
		<Folder name="Snippets">
			{/* Large cards — 2 col span, 2 row span */}
			<Composition
				id="TemplateEdit"
				component={TemplateEdit}
				durationInFrames={seconds(5)}
				fps={30}
				width={680}
				height={480}
			/>
			<Composition
				id="WorkflowConnect"
				component={WorkflowConnect}
				durationInFrames={seconds(5)}
				fps={30}
				width={680}
				height={480}
			/>

			{/* Small cards — 1 col, 1 row */}
			<Composition
				id="EventTimeline"
				component={EventTimeline}
				durationInFrames={seconds(4)}
				fps={30}
				width={340}
				height={280}
			/>
			<Composition
				id="MetricsCountUp"
				component={MetricsCountUp}
				durationInFrames={seconds(4)}
				fps={30}
				width={340}
				height={280}
			/>
			<Composition
				id="ContactSegment"
				component={ContactSegment}
				durationInFrames={seconds(5)}
				fps={30}
				width={340}
				height={280}
			/>
			<Composition
				id="StatusBadgeFlow"
				component={StatusBadgeFlow}
				durationInFrames={seconds(4)}
				fps={30}
				width={340}
				height={280}
			/>

			{/* Full-width card — 3 col span */}
			<Composition
				id="BroadcastSend"
				component={BroadcastSend}
				durationInFrames={seconds(7)}
				fps={30}
				width={1020}
				height={420}
			/>
		</Folder>

		<Folder name="Full">
			<Composition
				id="DeployFlow"
				component={DeployFlow}
				durationInFrames={seconds(18)}
				fps={30}
				width={1920}
				height={1080}
				schema={DeployFlowSchema}
				defaultProps={{
					domain: "acme.dev",
					region: "us-east-1",
					regionLabel: "US East (N. Virginia)",
				}}
			/>
		</Folder>
	</>
);
