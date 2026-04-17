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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
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
          <StaggerContainer
            className="grid gap-3 md:grid-cols-2"
            staggerDelay={0.08}
          >
            <VideoCard
              description="Describe your email, AI generates React Email code. Live preview as you iterate."
              title="AI Template Editor"
              video="/landing/TemplateEdit.mp4"
            />
            <VideoCard
              description="Describe your automation, AI builds it. Drag to refine."
              title="AI Workflow Builder"
              video="/landing/WorkflowConnect.mp4"
            />
          </StaggerContainer>

          {/* Row 2: Broadcasts (wide) + Event Timeline */}
          <StaggerContainer
            className="grid gap-3 md:grid-cols-3"
            staggerDelay={0.08}
          >
            <VideoCard
              className="md:col-span-2"
              description="Send to thousands, Sankey chart fills in — delivered, opened, clicked."
              title="Broadcasts & Delivery Funnel"
              video="/landing/BroadcastSend.mp4"
            />
            <VideoCard
              description="Full email lifecycle with timestamps and metadata."
              title="Event Timeline"
              video="/landing/EventTimeline.mp4"
            />
          </StaggerContainer>

          {/* Row 3: Three equal — Logs + Segments + Metrics */}
          <StaggerContainer
            className="grid gap-3 md:grid-cols-3"
            staggerDelay={0.08}
          >
            <VideoCard
              description="Status, recipient, subject — searchable and filterable."
              title="Live Email Logs"
              video="/landing/StatusBadgeFlow.mp4"
            />
            <VideoCard
              description="Filter audiences, watch matching contacts narrow."
              title="Contact Segments"
              video="/landing/ContactSegment.mp4"
            />
            <VideoCard
              description="Open rate, click rate, bounces — from your SES events."
              title="Delivery Metrics"
              video="/landing/MetricsCountUp.mp4"
            />
          </StaggerContainer>
        </div>
      </div>
    </section>
  );
}
