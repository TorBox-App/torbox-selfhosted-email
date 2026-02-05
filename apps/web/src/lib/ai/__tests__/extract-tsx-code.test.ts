import { describe, expect, it } from "vitest";
import { extractTsxCode } from "../extract-tsx-code";

describe("extractTsxCode", () => {
  it("should extract code from ```tsx block", () => {
    const content = `Here's the email template:

\`\`\`tsx
import { Html } from "@react-email/components";

export default function Welcome() {
  return <Html />;
}
\`\`\`

Let me know if you want changes.`;

    const result = extractTsxCode(content);
    expect(result).toContain('import { Html } from "@react-email/components"');
    expect(result).toContain("export default function Welcome");
  });

  it("should extract code from ```typescript block", () => {
    const content = `\`\`\`typescript
import { Html } from "@react-email/components";
export default () => <Html />;
\`\`\``;

    const result = extractTsxCode(content);
    expect(result).toContain("import { Html }");
  });

  it("should extract code from ```ts block", () => {
    const content = `\`\`\`ts
import { Html } from "@react-email/components";
export default () => <Html />;
\`\`\``;

    const result = extractTsxCode(content);
    expect(result).toContain("import { Html }");
  });

  it("should extract from generic code block with import", () => {
    const content = `\`\`\`
import { Html, Body } from "@react-email/components";
export default () => <Html><Body /></Html>;
\`\`\``;

    const result = extractTsxCode(content);
    expect(result).toContain("import { Html, Body }");
  });

  it("should NOT extract from generic code block without import", () => {
    const content = `\`\`\`
const x = 1;
console.log(x);
\`\`\``;

    const result = extractTsxCode(content);
    expect(result).toBeNull();
  });

  it("should return null when no code block present", () => {
    const content = "Here is some text without any code blocks.";
    const result = extractTsxCode(content);
    expect(result).toBeNull();
  });

  it("should prefer tsx block over ts block", () => {
    const content = `\`\`\`tsx
const tsxCode = "from tsx block";
import { Html } from "@react-email/components";
\`\`\`

\`\`\`ts
const tsCode = "from ts block";
import { Html } from "@react-email/components";
\`\`\``;

    const result = extractTsxCode(content);
    expect(result).toContain("tsxCode");
    expect(result).not.toContain("tsCode");
  });

  it("should trim whitespace from extracted code", () => {
    const content = `\`\`\`tsx

  import { Html } from "@react-email/components";
  export default () => <Html />;

\`\`\``;

    const result = extractTsxCode(content);
    expect(result).toBe(
      'import { Html } from "@react-email/components";\n  export default () => <Html />;'
    );
  });

  it("should handle multiline code blocks", () => {
    const content = `\`\`\`tsx
import {
  Html,
  Head,
  Body,
  Container,
  Text,
} from "@react-email/components";

export const subject = "Welcome!";
export const emailType = "transactional";

export default function WelcomeEmail(props: { name?: string }) {
  return (
    <Html>
      <Head />
      <Body>
        <Container>
          <Text>Hello {props.name}!</Text>
        </Container>
      </Body>
    </Html>
  );
}
\`\`\``;

    const result = extractTsxCode(content);
    expect(result).toContain("export const subject");
    expect(result).toContain("export default function WelcomeEmail");
    expect(result).toContain("props.name");
  });
});
