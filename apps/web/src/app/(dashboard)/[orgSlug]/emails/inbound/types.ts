export type InboundEmailListItem = {
  id: string;
  from: string;
  to: string[];
  subject: string;
  receivedAt: string;
  hasAttachments: boolean;
  attachmentCount: number;
  spamVerdict: string | null;
  virusVerdict: string | null;
  accountId: string;
};
