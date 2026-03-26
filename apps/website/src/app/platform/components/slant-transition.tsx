export function SlantTransition() {
  return (
    <div className="relative h-20">
      <div
        className="absolute inset-0 bg-stone-100/50 dark:bg-white/[0.06]"
        style={{
          clipPath: "polygon(0 0, 100% 0, 0 100%)",
        }}
      />
    </div>
  );
}
