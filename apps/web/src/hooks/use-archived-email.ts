import { useQuery } from "@tanstack/react-query";

type ArchivedEmail = {
  messageId: string;
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
  attachments: Array<{
    filename?: string;
    contentType: string;
    size: number;
  }>;
  headers: Record<string, string | string[] | undefined>;
  timestamp: Date;
  metadata?: {
    senderIp?: string;
    tlsProtocol?: string;
    tlsCipherSuite?: string;
    senderHostname?: string;
  };
};

export function useArchivedEmail(
  orgSlug: string,
  messageId: string,
  enabled: boolean
) {
  return useQuery<ArchivedEmail | null>({
    queryKey: ["archived-email", orgSlug, messageId],
    queryFn: async () => {
      const encodedId = encodeURIComponent(messageId);
      const response = await fetch(
        `/api/${orgSlug}/emails/${encodedId}/archive`
      );

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(
          `Failed to fetch archived email: ${response.statusText}`
        );
      }

      const data = await response.json();
      return {
        ...data,
        timestamp: new Date(data.timestamp),
      };
    },
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
