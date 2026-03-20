import { FileItem } from './types';

const generateHash = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

export const MOCK_DRIVE_A: FileItem[] = [
  { id: '1', name: 'vacation_photo_01.jpg', path: '/Photos/2024/vacation_photo_01.jpg', size: 2400000, type: 'image/jpeg', lastModified: '2024-01-15', hash: 'h1', source: 'drive-a' },
  { id: '2', name: 'budget_2023.xlsx', path: '/Documents/Work/budget_2023.xlsx', size: 45000, type: 'application/vnd.ms-excel', lastModified: '2023-12-20', hash: 'h2', source: 'drive-a' },
  { id: '3', name: 'project_final_v2.mp4', path: '/Videos/Projects/project_final_v2.mp4', size: 850000000, type: 'video/mp4', lastModified: '2024-02-10', hash: 'h3', source: 'drive-a' },
  { id: '4', name: 'notes.txt', path: '/Documents/Personal/notes.txt', size: 1200, type: 'text/plain', lastModified: '2024-03-01', hash: 'h4', source: 'drive-a' },
  { id: '5', name: 'duplicate_copy.jpg', path: '/Downloads/duplicate_copy.jpg', size: 2400000, type: 'image/jpeg', lastModified: '2024-01-15', hash: 'h1', source: 'drive-a' },
  { id: '6', name: 'old_backup.zip', path: '/Backups/old_backup.zip', size: 1200000000, type: 'application/zip', lastModified: '2023-05-10', hash: 'h5', source: 'drive-a' },
  { id: '7', name: 'system_log.log', path: '/Logs/system_log.log', size: 500000, type: 'text/plain', lastModified: '2024-03-18', hash: 'h6', source: 'drive-a' },
];

export const MOCK_DRIVE_B: FileItem[] = [
  { id: 'b1', name: 'vacation_photo_01.jpg', path: '/Backup/Photos/vacation_photo_01.jpg', size: 2400000, type: 'image/jpeg', lastModified: '2024-01-15', hash: 'h1', source: 'drive-b' },
  { id: 'b2', name: 'budget_2023.xlsx', path: '/Backup/Docs/budget_2023.xlsx', size: 45000, type: 'application/vnd.ms-excel', lastModified: '2023-12-20', hash: 'h2', source: 'drive-b' },
  { id: 'b4', name: 'notes_updated.txt', path: '/Backup/Docs/notes.txt', size: 1500, type: 'text/plain', lastModified: '2024-03-15', hash: 'h4-updated', source: 'drive-b' },
  { id: 'b8', name: 'new_document.pdf', path: '/Backup/Docs/new_document.pdf', size: 1200000, type: 'application/pdf', lastModified: '2024-03-10', hash: 'h8', source: 'drive-b' },
  { id: 'b9', name: 'family_video.mov', path: '/Backup/Videos/family_video.mov', size: 450000000, type: 'video/quicktime', lastModified: '2024-01-05', hash: 'h9', source: 'drive-b' },
];
