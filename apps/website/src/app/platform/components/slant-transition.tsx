export function SlantTransition() {
  return (
    <div className="relative h-20">
      <div
        className="absolute inset-0 bg-muted/30"
        style={{
          clipPath: "polygon(0 0, 100% 0, 0 100%)",
        }}
      />
    </div>
  );
}
