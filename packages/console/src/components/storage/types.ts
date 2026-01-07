/**
 * Storage Library Types
 */

export type ViewMode = "grid" | "table";

export type StorageTag = {
  key: string;
  value: string;
};

export type StorageFile = {
  key: string;
  size: number;
  lastModified: string;
  contentType?: string;
  url: string;
  tags: StorageTag[];
  starred: boolean;
};

export type FilterOptions = {
  starred: boolean;
  formats: string[];
};

export type StorageInfo = {
  bucketName: string;
  region: string;
  cdnDomain?: string;
  customDomain?: string;
  files: StorageFile[];
  totalSize: number;
  fileCount: number;
};
