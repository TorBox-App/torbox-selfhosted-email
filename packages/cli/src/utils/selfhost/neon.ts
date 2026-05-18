export type NeonProject = {
  id: string;
  name: string;
  connectionString: string;
};

/**
 * Provision a new Neon project and return id + connection string.
 * The connection string returned is the direct (non-pooled) connection URI,
 * needed for running Drizzle migrations.
 */
export async function provisionNeonProject(
  apiKey: string,
  projectName: string,
  options: { region?: string; orgId?: string } = {}
): Promise<NeonProject> {
  const { region = "aws-us-east-2", orgId } = options;
  const projectPayload: Record<string, unknown> = {
    name: projectName,
    pg_version: 16,
    region_id: region,
  };
  if (orgId) projectPayload.org_id = orgId;

  const response = await fetch("https://console.neon.tech/api/v2/projects", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ project: projectPayload }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      string
    >;
    throw new Error(
      `Neon API error ${response.status}: ${body.message ?? response.statusText}`
    );
  }

  const data = (await response.json()) as {
    project: { id: string; name: string };
    connection_uris: Array<{ connection_uri: string }>;
  };

  const connectionString = data.connection_uris?.[0]?.connection_uri;
  if (!connectionString) {
    throw new Error(
      "Neon project created but no connection string returned. Check the Neon console."
    );
  }

  return {
    id: data.project.id,
    name: data.project.name,
    connectionString,
  };
}

/**
 * Build a stable project name for a given deployment.
 */
export function buildNeonProjectName(
  accountId: string,
  region: string
): string {
  return `wraps-selfhost-${accountId}-${region}`;
}
