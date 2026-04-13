import { createElement } from "react";
import { lintComponent } from "@email-lint/react-email";

const templates = import.meta.glob<{
  default: (props: Record<string, unknown>) => React.ReactElement;
  testData?: Record<string, unknown>;
}>("../*.tsx", { eager: true });

for (const [path, mod] of Object.entries(templates)) {
  const name = path.replace("../", "").replace(".tsx", "");
  const Component = mod.default;
  if (typeof Component !== "function") continue;

  const props = mod.testData ?? {};

  test(`${name} passes Gmail compatibility`, async () => {
    const result = await lintComponent(createElement(Component, props), {
      preset: "gmail",
    });
    if (result.errorCount > 0) {
      const errors = result.diagnostics
        .filter((d) => d.severity === "error")
        .map(
          (d) =>
            `  ${d.title}: ${d.message} (${d.variants.length}/${d.familySize} variants) [${d.family}]`,
        )
        .join("\n");
      throw new Error(`${result.errorCount} error(s):\n${errors}`);
    }
  });
}
