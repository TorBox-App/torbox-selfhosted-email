// Contacts types and constants - shared between server actions and client components

export const CONTACT_STATUSES = [
  "pending_confirmation",
  "active",
  "unsubscribed",
  "bounced",
  "complained",
] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  pending_confirmation: "Pending Confirmation",
  active: "Active",
  unsubscribed: "Unsubscribed",
  bounced: "Bounced",
  complained: "Complained",
};

export const CONTACT_STATUS_COLORS: Record<ContactStatus, string> = {
  pending_confirmation: "bg-yellow-100 text-yellow-800",
  active: "bg-green-100 text-green-800",
  unsubscribed: "bg-gray-100 text-gray-800",
  bounced: "bg-red-100 text-red-800",
  complained: "bg-red-100 text-red-800",
};

// Contact with relations
export type ContactWithMeta = {
  id: string;
  email: string;
  status: ContactStatus;
  properties: Record<string, unknown>;
  lastActivityAt: Date | null;
  lastEmailSentAt: Date | null;
  lastEmailOpenedAt: Date | null;
  lastEmailClickedAt: Date | null;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt: Date | null;
  unsubscribedAt: Date | null;
  bouncedAt: Date | null;
  complainedAt: Date | null;
  createdBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  topics?: {
    topicId: string;
    topicName: string;
    status: string;
    subscribedAt: Date | null;
  }[];
};

// Result types
export type ListContactsResult =
  | {
      success: true;
      contacts: ContactWithMeta[];
      total: number;
      page: number;
      pageSize: number;
    }
  | { success: false; error: string };

export type GetContactResult =
  | { success: true; contact: ContactWithMeta }
  | { success: false; error: string };

export type CreateContactResult =
  | { success: true; contact: ContactWithMeta }
  | { success: false; error: string };

export type UpdateContactResult =
  | { success: true; contact: ContactWithMeta }
  | { success: false; error: string };

export type DeleteContactResult =
  | { success: true }
  | { success: false; error: string };

export type ImportContactsResult =
  | { success: true; imported: number; skipped: number; errors: string[] }
  | { success: false; error: string };
