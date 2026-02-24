export type SMSStatus =
  | "sent"
  | "delivered"
  | "failed"
  | "queued"
  | "blocked"
  | "invalid"
  | "opted_out"
  | "carrier_unreachable"
  | "ttl_expired";

export type SMSEvent = {
  type: SMSStatus;
  timestamp: number;
  metadata?: Record<string, unknown>;
};

export type SMS = {
  id: string;
  messageId: string;
  destinationNumber: string;
  originationNumber?: string;
  status: SMSStatus;
  sentAt: number;
  events: SMSEvent[];
  metadata?: Record<string, unknown>;
};

export type SMSListItem = {
  id: string;
  messageId: string;
  destinationNumber: string;
  originationNumber?: string;
  status: SMSStatus;
  sentAt: number;
};
