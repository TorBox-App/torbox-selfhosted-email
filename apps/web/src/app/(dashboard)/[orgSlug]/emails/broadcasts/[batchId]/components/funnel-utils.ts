type FunnelIssue = {
  label: string;
  count: number;
};

export type FunnelStage = {
  label: string;
  count: number;
  widthPercent: number;
  rate: number | null;
  issues: FunnelIssue[];
};

type FunnelInput = {
  channel: "email" | "sms";
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  bounced: number;
  complained: number;
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function calculateFunnelStages(input: FunnelInput): FunnelStage[] {
  const {
    channel,
    sent,
    delivered,
    opened,
    clicked,
    failed,
    bounced,
    complained,
  } = input;

  const sentIssues: FunnelIssue[] = [];
  if (failed > 0) {
    sentIssues.push({ label: "failed", count: failed });
  }

  const deliveredIssues: FunnelIssue[] = [];
  if (bounced > 0) {
    deliveredIssues.push({ label: "bounced", count: bounced });
  }
  if (complained > 0) {
    deliveredIssues.push({ label: "complained", count: complained });
  }

  const stages: FunnelStage[] = [
    {
      label: "Sent",
      count: sent,
      widthPercent: 100,
      rate: null,
      issues: sentIssues,
    },
    {
      label: "Delivered",
      count: delivered,
      widthPercent: sent === 0 ? 0 : round1((delivered / sent) * 100),
      rate: sent === 0 ? 0 : round1((delivered / sent) * 100),
      issues: deliveredIssues,
    },
  ];

  if (channel === "email") {
    stages.push({
      label: "Opened",
      count: opened,
      widthPercent: sent === 0 ? 0 : round1((opened / sent) * 100),
      rate: delivered === 0 ? 0 : round1((opened / delivered) * 100),
      issues: [],
    });

    stages.push({
      label: "Clicked",
      count: clicked,
      widthPercent: sent === 0 ? 0 : round1((clicked / sent) * 100),
      rate: opened === 0 ? 0 : round1((clicked / opened) * 100),
      issues: [],
    });
  }

  return stages;
}

/**
 * Generate an SVG path for a smooth flowing funnel shape.
 * Each width in `widths` is a percentage (0-100) representing the band height
 * at that stage. The path connects stages with cubic bezier curves.
 */
export function generateFunnelPath(
  widths: number[],
  dimensions: { width: number; height: number }
): string {
  if (widths.length < 2) {
    return "";
  }

  const { width, height } = dimensions;
  const stageCount = widths.length;
  const sectionWidth = width / (stageCount - 1);
  const centerY = height / 2;
  // Minimum band height so the last stage is always visible
  const minHeightPx = 4;

  // Convert percentage widths to pixel half-heights at each stage
  const halfHeights = widths.map((w) =>
    Math.max((w / 100) * (height / 2), minHeightPx / 2)
  );

  // X positions for each stage
  const xs = widths.map((_, i) => i * sectionWidth);

  // Build top edge (left to right) then bottom edge (right to left)
  const parts: string[] = [];

  // Start at top-left
  parts.push(`M ${xs[0]} ${centerY - halfHeights[0]!}`);

  // Top edge: bezier curves between each pair of stages
  for (let i = 0; i < stageCount - 1; i++) {
    const x1 = xs[i]!;
    const x2 = xs[i + 1]!;
    const y1 = centerY - halfHeights[i]!;
    const y2 = centerY - halfHeights[i + 1]!;
    const cx = (x2 - x1) / 2;
    parts.push(`C ${x1 + cx} ${y1}, ${x2 - cx} ${y2}, ${x2} ${y2}`);
  }

  // Line to bottom-right
  const lastIdx = stageCount - 1;
  parts.push(`L ${xs[lastIdx]} ${centerY + halfHeights[lastIdx]!}`);

  // Bottom edge: bezier curves from right to left
  for (let i = stageCount - 1; i > 0; i--) {
    const x1 = xs[i]!;
    const x2 = xs[i - 1]!;
    const y1 = centerY + halfHeights[i]!;
    const y2 = centerY + halfHeights[i - 1]!;
    const cx = (x1 - x2) / 2;
    parts.push(`C ${x1 - cx} ${y1}, ${x2 + cx} ${y2}, ${x2} ${y2}`);
  }

  parts.push("Z");
  return parts.join(" ");
}

/**
 * Generate one SVG path per section so each can be rendered with a different color.
 * Returns N-1 paths for N stages.
 */
export function generateFunnelSectionPaths(
  widths: number[],
  dimensions: { width: number; height: number }
): string[] {
  if (widths.length < 2) {
    return [];
  }

  const { width, height } = dimensions;
  const stageCount = widths.length;
  const sectionWidth = width / (stageCount - 1);
  const centerY = height / 2;
  const minHeightPx = 4;

  const halfHeights = widths.map((w) =>
    Math.max((w / 100) * (height / 2), minHeightPx / 2)
  );
  const xs = widths.map((_, i) => i * sectionWidth);

  const paths: string[] = [];

  for (let i = 0; i < stageCount - 1; i++) {
    const x1 = xs[i]!;
    const x2 = xs[i + 1]!;
    const h1 = halfHeights[i]!;
    const h2 = halfHeights[i + 1]!;
    const cx = (x2 - x1) / 2;

    const parts = [
      // Top-left
      `M ${x1} ${centerY - h1}`,
      // Top edge (bezier to top-right)
      `C ${x1 + cx} ${centerY - h1}, ${x2 - cx} ${centerY - h2}, ${x2} ${centerY - h2}`,
      // Right edge
      `L ${x2} ${centerY + h2}`,
      // Bottom edge (bezier back to bottom-left)
      `C ${x2 - cx} ${centerY + h2}, ${x1 + cx} ${centerY + h1}, ${x1} ${centerY + h1}`,
      "Z",
    ];
    paths.push(parts.join(" "));
  }

  return paths;
}
