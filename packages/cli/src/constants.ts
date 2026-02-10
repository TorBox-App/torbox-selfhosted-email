export const DEFAULT_AWS_REGION = "us-east-1";

export function getDefaultRegion(): string {
  return process.env.AWS_REGION || DEFAULT_AWS_REGION;
}

export function getResourceTags(
  service: string,
  extra?: Record<string, string>
): Record<string, string> {
  return {
    ManagedBy: "wraps-cli",
    Service: service,
    ...extra,
  };
}
