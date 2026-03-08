import { Hr, Link, Section, Text } from "@react-email/components";

type FooterProps = {
  unsubscribeUrl: string;
};

export function Footer({ unsubscribeUrl }: FooterProps) {
  return (
    <Section className="px-10 py-5 text-center">
      <Hr className="mb-5 border-gray-200" />
      <Text className="m-0 mb-2 text-xs text-gray-400">
        Wraps &bull; Boulder, CO
      </Text>
      <Link className="text-xs text-gray-400 underline" href={unsubscribeUrl}>
        Unsubscribe
      </Link>
    </Section>
  );
}
