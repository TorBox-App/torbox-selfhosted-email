/**
 * Cdn Library Types
 */

export type ViewMode = "grid" | "table";

export type CdnTag = {
  key: string;
  value: string;
};

export type CdnFile = {
  key: string;
  size: number;
  lastModified: string;
  contentType?: string;
  url: string;
  tags: CdnTag[];
  starred: boolean;
};

export type FilterOptions = {
  starred: boolean;
  formats: string[];
};

export type CdnInfo = {
  bucketName: string;
  region: string;
  cdnDomain?: string;
  customDomain?: string;
  files: CdnFile[];
  totalSize: number;
  fileCount: number;
};
