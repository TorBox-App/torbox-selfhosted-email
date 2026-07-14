import { SectionKicker } from "./section-kicker";

type Tile = {
  index: string;
  title: string;
  meta?: string;
  video: string;
  span: "wide" | "tall" | "sm";
  videoClassName?: string;
};

const tiles: Tile[] = [
  {
    index: "01",
    title: "One-command deploy",
    meta: "SES, DynamoDB, Lambda in 38s",
    video: "/landing/DeployFlow.mp4",
    span: "wide",
    videoClassName: "scale-[1.5]",
  },
  {
    index: "02",
    title: "Broadcasts",
    meta: "compose once, send to thousands",
    video: "/landing/BroadcastSend.mp4",
    span: "wide",
  },
  {
    index: "03",
    title: "Audience segments",
    video: "/landing/ContactSegment.mp4",
    span: "tall",
  },
  {
    index: "04",
    title: "Templates as code",
    video: "/landing/TemplateEdit.mp4",
    span: "sm",
  },
  {
    index: "05",
    title: "Workflows",
    video: "/landing/WorkflowConnect.mp4",
    span: "sm",
  },
  {
    index: "06",
    title: "Live analytics",
    video: "/landing/MetricsCountUp.mp4",
    span: "sm",
  },
  {
    index: "07",
    title: "Every send, tracked",
    video: "/landing/StatusBadgeFlow.mp4",
    span: "sm",
  },
];

const spanClass: Record<Tile["span"], string> = {
  wide: "md:col-span-3 md:row-span-2",
  tall: "md:col-span-2 md:row-span-2",
  sm: "md:col-span-2",
};

export function ProductShowcaseSection() {
  return (
    <section className="border-border border-b py-20 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionKicker>Product tour</SectionKicker>
        <h2 className="mb-8 max-w-[24ch] font-heading font-semibold text-[30px] text-foreground leading-[1.08] tracking-[-0.022em] md:text-[40px]">
          Everything that happens after you hit send.
        </h2>

        <div className="grid grid-cols-2 gap-3.5 md:auto-rows-[196px] md:grid-cols-6">
          {tiles.map((tile) => (
            <div
              className={`col-span-2 flex min-h-[220px] flex-col overflow-hidden rounded-lg border border-border bg-zinc-950 md:min-h-0 ${spanClass[tile.span]}`}
              key={tile.index}
            >
              <div className="relative min-h-0 flex-1 overflow-hidden">
                <video
                  autoPlay
                  className={`size-full object-cover ${tile.videoClassName ?? ""}`}
                  loop
                  muted
                  playsInline
                  poster={tile.video
                    .replace("/landing/", "/landing/posters/")
                    .replace(".mp4", ".jpg")}
                  preload="metadata"
                  src={tile.video}
                >
                  <track kind="descriptions" label={tile.title} />
                </video>
              </div>
              <div className="flex items-baseline gap-2 border-white/10 border-t bg-zinc-950 px-3.5 py-2.5">
                <span className="font-mono text-[11px] text-orange-500">
                  {tile.index}
                </span>
                <span className="font-medium text-[13px] text-white">
                  {tile.title}
                  {tile.meta ? (
                    <small className="ml-1.5 font-normal text-[11px] text-zinc-400">
                      {tile.meta}
                    </small>
                  ) : null}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
