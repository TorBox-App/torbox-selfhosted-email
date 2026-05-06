const styles = {
  tip: "border-green-500/50 bg-green-500/10",
  warning: "border-yellow-500/50 bg-yellow-500/10",
  danger: "border-red-500/50 bg-red-500/10",
};

const iconStyles = {
  tip: "text-green-600 dark:text-green-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  danger: "text-red-600 dark:text-red-400",
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
