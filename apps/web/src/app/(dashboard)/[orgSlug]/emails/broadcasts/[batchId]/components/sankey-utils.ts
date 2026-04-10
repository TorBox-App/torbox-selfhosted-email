export function truncateUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.hostname}${path}`;
  } catch {
    return url.length > 40 ? `${url.slice(0, 37)}...` : url;
  }
}

type SankeyNode = {
  name: string;
};

type SankeyLink = {
  source: number;
  target: number;
  value: number;
};

type ClickByUrl = { url: string; count: number };

type SankeyInput = {
  channel: "email" | "sms";
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  bounced: number;
  complained: number;
  hardBounced: number;
  softBounced: number;
  clicksByUrl?: ClickByUrl[];
};

type SankeyData = {
  nodes: SankeyNode[];
  links: SankeyLink[];
};

export function buildSankeyData(input: SankeyInput): SankeyData {
  const {
    channel,
    sent,
    delivered,
    opened,
    clicked,
    failed,
    complained,
    hardBounced,
    softBounced,
  } = input;

  // Build nodes and links, omitting zero-value entries
  const nodeMap = new Map<string, number>();
  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];

  function addNode(name: string): number {
    const existing = nodeMap.get(name);
    if (existing !== undefined) {
      return existing;
    }
    const idx = nodes.length;
    nodes.push({ name });
    nodeMap.set(name, idx);
    return idx;
  }

  function addLink(sourceName: string, targetName: string, value: number) {
    if (value <= 0) {
      return;
    }
    const source = addNode(sourceName);
    const target = addNode(targetName);
    links.push({ source, target, value });
  }

  if (sent === 0) {
    // Still create nodes for the structure, but all links will be zero
    addNode("Sent");
    addNode("Delivered");
    if (channel === "email") {
      addNode("Opened");
      addNode("Not Opened");
      addNode("Clicked");
      addNode("No Click");
    }
    return { nodes, links };
  }

  // Column 1: Sent splits into Delivered, Hard Bounce, Soft Bounce, Failed
  addNode("Sent");
  addLink("Sent", "Delivered", delivered);
  addLink("Sent", "Hard Bounce", hardBounced);
  addLink("Sent", "Soft Bounce", softBounced);
  addLink("Sent", "Failed", failed);

  if (channel === "email") {
    // Column 2: Delivered splits into Opened, Not Opened, Complained
    addLink("Delivered", "Opened", opened);
    addLink("Delivered", "Complained", complained);
    const notOpened = delivered - opened - complained;
    addLink("Delivered", "Not Opened", notOpened);

    // Column 3: Opened splits into per-URL clicks or aggregate Clicked
    if (input.clicksByUrl && input.clicksByUrl.length > 0) {
      const top = input.clicksByUrl.slice(0, 5);
      const rest = input.clicksByUrl.slice(5);
      const otherCount = rest.reduce((sum, u) => sum + u.count, 0);

      for (const { url, count } of top) {
        addLink("Opened", truncateUrl(url), count);
      }
      if (otherCount > 0) {
        addLink("Opened", "Other URLs", otherCount);
      }
      const noClick = opened - clicked;
      addLink("Opened", "No Click", noClick);
    } else {
      addLink("Opened", "Clicked", clicked);
      const noClick = opened - clicked;
      addLink("Opened", "No Click", noClick);
    }
  }

  return { nodes, links };
}
