const styles = {
  tip: "border-success/50 bg-success/10",
  warning: "border-warning/50 bg-warning/10",
  danger: "border-destructive/50 bg-destructive/10",
};

const iconStyles = {
  tip: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

export const InfoCard = ({
  type = "tip",
  icon: Icon,
  title,
  children,
}: {
  type?: "tip" | "warning" | "danger";
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) => (
  <div className={`my-6 rounded-xl border p-4 ${styles[type]}`}>
    <div
      className={`mb-2 flex items-center gap-2 font-semibold ${iconStyles[type]}`}
    >
      <Icon className="h-4 w-4" />
      {title}
    </div>
    <div className="text-foreground/80 text-sm">{children}</div>
  </div>
);
