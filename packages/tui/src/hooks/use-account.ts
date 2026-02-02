import { useCallback, useEffect, useState } from "react";
import {
  fetchEmailEvents,
  getCallerIdentity,
  getRegion,
  getSendQuota,
  listDomains,
} from "../lib/aws";
import { checkDomainDns } from "../lib/dns";
import { loadConnectionMetadata } from "../lib/metadata";
import type { AccountData } from "../types";

type UseAccountResult = {
  loading: boolean;
  error: string | null;
  data: AccountData | null;
  refresh: () => void;
};

export function useAccount(): UseAccountResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AccountData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const region = getRegion();

      // 1. Validate credentials
      const identity = await getCallerIdentity(region);

      // 2. Load connection metadata
      const metadata = await loadConnectionMetadata(identity.accountId, region);

      // 3. Fetch SES domains with DKIM status
      const sesIdentities = await listDomains(region);

      // 4. Check DNS for each domain
      const domains = await Promise.all(
        sesIdentities.map((id) => checkDomainDns(id))
      );

      // 5. Get send quota + email events in parallel
      const [quota, events] = await Promise.all([
        getSendQuota(region),
        fetchEmailEvents(region, identity.accountId),
      ]);

      setData({
        accountId: identity.accountId,
        arn: identity.arn,
        region,
        metadata,
        domains,
        quota,
        events,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load AWS data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { loading, error, data, refresh: load };
}
