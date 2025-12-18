// API Key types and constants - shared between server actions and client components

// API Key prefixes
export const API_KEY_PREFIXES = {
  live: "wraps_live_",
  test: "wraps_test_",
  restricted: "wraps_rk_",
} as const;

export type ApiKeyType = keyof typeof API_KEY_PREFIXES;

// Available permissions
export const API_KEY_PERMISSIONS = [
  "contacts:read",
  "contacts:write",
  "topics:read",
  "topics:write",
  "segments:read",
  "segments:write",
  "campaigns:read",
  "campaigns:write",
  "workflows:read",
  "workflows:write",
  "analytics:read",
  "send:email",
] as const;

export type ApiKeyPermission = (typeof API_KEY_PERMISSIONS)[number];

// Full access permission sets
export const FULL_ACCESS_PERMISSIONS: ApiKeyPermission[] = [
  "contacts:read",
  "contacts:write",
  "topics:read",
  "topics:write",
  "segments:read",
  "segments:write",
  "campaigns:read",
  "campaigns:write",
  "workflows:read",
  "workflows:write",
  "analytics:read",
  "send:email",
];

export const READ_ONLY_PERMISSIONS: ApiKeyPermission[] = [
  "contacts:read",
  "topics:read",
  "segments:read",
  "campaigns:read",
  "workflows:read",
  "analytics:read",
];

// Result types
export type ApiKeyWithMeta = {
  id: string;
  name: string;
  prefix: string;
  permissions: ApiKeyPermission[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  createdBy: {
    id: string;
    name: string;
    email: string;
  } | null;
};

export type ListApiKeysResult =
  | { success: true; apiKeys: ApiKeyWithMeta[] }
  | { success: false; error: string };

export type CreateApiKeyResult =
  | { success: true; apiKey: ApiKeyWithMeta; secretKey: string }
  | { success: false; error: string };

export type DeleteApiKeyResult =
  | { success: true }
  | { success: false; error: string };

export type UpdateApiKeyResult =
  | { success: true; apiKey: ApiKeyWithMeta }
  | { success: false; error: string };
