import { createAuthClient } from "better-auth/client";
import {
  deviceAuthorizationClient,
  organizationClient,
} from "better-auth/client/plugins";
import type { OrgInfo } from "./config.js";

export function createCliAuthClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [deviceAuthorizationClient(), organizationClient()],
  });
}

export async function fetchOrganizations(
  baseURL: string,
  token: string
): Promise<OrgInfo[]> {
  try {
    const client = createCliAuthClient(baseURL);
    const { data } = await client.organization.list({
      fetchOptions: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });
    if (!data) return [];
    return data.map((org: { id: string; name: string; slug: string }) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
    }));
    // baseline:allow-next-line no-swallowed-errors — org list is optional
  } catch {
    return [];
  }
}
