"use client";

import { FadeIn, StaggerContainer, StaggerItem } from "./animations";

type VideoCardProps = {
	title: string;
	description: string;
	video: string;
	className?: string;
};

function VideoCard({ title, description, video, className }: VideoCardProps) {
	return (
		<StaggerItem
			className={`group overflow-hidden rounded-xl border border-border/50 bg-card ${className ?? ""}`}
		>
			<div className="overflow-hidden bg-background">
				<video
					autoPlay
					className="w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.02]"
					loop
					muted
					playsInline
					preload="none"
					src={video}
				>
					<track kind="descriptions" label={title} />
				</video>
			</div>
			<div className="border-t border-border/50 px-4 py-3">
				<h3 className="font-semibold text-sm text-foreground">{title}</h3>
				<p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
					{description}
				</p>
			</div>
		</StaggerItem>
	);
}

export function ProductShowcaseSection() {
	return (
		<section className="py-16 md:py-24" id="features">
			<div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
				<FadeIn className="text-center">
					<h2 className="font-bold text-3xl tracking-tight font-heading md:text-4xl text-balance">
						Everything you need to send.{" "}
						<span className="text-muted-foreground">
							Nothing you don&apos;t.
						</span>
					</h2>
					<p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
						Templates, workflows, analytics, and event tracking — all running on
						your AWS, all visible in one dashboard.
					</p>
				</FadeIn>

				<div className="mt-12 flex flex-col gap-3">
					{/* Row 1: AI Templates + AI Workflows — the two hero features */}
					<StaggerContainer className="grid gap-3 md:grid-cols-2" staggerDelay={0.08}>
						<VideoCard
							title="AI Template Editor"
							description="Describe your email, AI generates React Email code. Live preview as you iterate."
							video="/landing/TemplateEdit.mp4"
						/>
						<VideoCard
							title="AI Workflow Builder"
							description="Describe your automation, AI builds it. Drag to refine."
							video="/landing/WorkflowConnect.mp4"
						/>
					</StaggerContainer>

					{/* Row 2: Broadcasts (wide) + Event Timeline */}
					<StaggerContainer className="grid gap-3 md:grid-cols-3" staggerDelay={0.08}>
						<VideoCard
							title="Broadcasts & Delivery Funnel"
							description="Send to thousands, Sankey chart fills in — delivered, opened, clicked."
							video="/landing/BroadcastSend.mp4"
							className="md:col-span-2"
						/>
						<VideoCard
							title="Event Timeline"
							description="Full email lifecycle with timestamps and metadata."
							video="/landing/EventTimeline.mp4"
						/>
					</StaggerContainer>

					{/* Row 3: Three equal — Logs + Segments + Metrics */}
					<StaggerContainer className="grid gap-3 md:grid-cols-3" staggerDelay={0.08}>
						<VideoCard
							title="Live Email Logs"
							description="Status, recipient, subject — searchable and filterable."
							video="/landing/StatusBadgeFlow.mp4"
						/>
						<VideoCard
							title="Contact Segments"
							description="Filter audiences, watch matching contacts narrow."
							video="/landing/ContactSegment.mp4"
						/>
						<VideoCard
							title="Delivery Metrics"
							description="Open rate, click rate, bounces — from your SES events."
							video="/landing/MetricsCountUp.mp4"
						/>
					</StaggerContainer>
				</div>
			</div>
		</section>
	);
}
