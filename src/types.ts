export interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  lastModified: string;
  hash: string;
  source?: 'drive-a' | 'drive-b';
}

export interface DuplicateGroup {
  hash: string;
  files: FileItem[];
}

export interface SyncDiff {
  type: 'missing-in-a' | 'missing-in-b' | 'different-version' | 'duplicate-content';
  fileA?: FileItem;
  fileB?: FileItem;
  relPath: string;
}

export interface SyncStats {
  missingInA: number;
  missingInB: number;
  totalSizeForA: number;
  totalSizeForB: number;
  totalSizeToSync: number;
  scratchDiskNeeded: number;
  freeSpaceA: number;
  freeSpaceB: number;
  freeSpaceScratch: number;
}

export interface Session {
  id: string;
  name: string;
  timestamp: string;
  path: string;
}
