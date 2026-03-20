import React, { useState, useEffect } from 'react';
import { Folder, ChevronRight, Home, HardDrive, ArrowLeft, X } from 'lucide-react';

interface FolderPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  title: string;
}

interface FolderItem {
  name: string;
  path: string;
}

interface DriveItem {
  name: string;
  path: string;
}

export const FolderPicker: React.FC<FolderPickerProps> = ({ isOpen, onClose, onSelect, title }) => {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [parentPath, setParentPath] = useState<string>('');
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [drives, setDrives] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [sep, setSep] = useState<string>('/');

  useEffect(() => {
    if (isOpen) {
      fetchDrives();
      fetchDirectory('');
    }
  }, [isOpen]);

  const fetchDrives = async () => {
    try {
      const response = await fetch('/api/list-drives');
      const data = await response.json();
      setDrives(data);
    } catch (error) {
      console.error('Failed to fetch drives:', error);
    }
  };

  const fetchDirectory = async (path: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/list-directory?path=${encodeURIComponent(path)}`);
      const data = await response.json();
      setCurrentPath(data.currentPath);
      setParentPath(data.parentPath);
      setFolders(data.folders);
      if (data.sep) setSep(data.sep);
    } catch (error) {
      console.error('Failed to fetch directory:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // Split path into parts for breadcrumbs
  // On Windows, paths might be C:\Users\...
  // On Linux, paths are /home/user/...
  const getPathParts = () => {
    if (!currentPath) return [];
    
    // Handle Windows drive letter
    let pathForSplitting = currentPath;
    let drivePrefix = '';
    
    if (currentPath.includes(':\\')) {
      const [drive, ...rest] = currentPath.split(':\\');
      drivePrefix = drive + ':';
      pathForSplitting = rest.join(':\\');
    }

    const parts = pathForSplitting.split(sep).filter(Boolean);
    if (drivePrefix) {
      return [drivePrefix, ...parts];
    }
    return parts;
  };

  const navigateToPart = (index: number) => {
    const parts = getPathParts();
    const targetParts = parts.slice(0, index + 1);
    
    let targetPath = '';
    if (targetParts[0]?.endsWith(':')) {
      const drive = targetParts[0];
      const rest = targetParts.slice(1);
      targetPath = drive + sep + rest.join(sep);
    } else {
      targetPath = (sep === '/' ? '/' : '') + targetParts.join(sep);
    }
    
    fetchDirectory(targetPath);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
          <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-full transition-colors text-zinc-400 hover:text-zinc-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Path Bar */}
        <div className="p-3 bg-zinc-950 border-b border-zinc-800 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => fetchDirectory(parentPath)}
            disabled={currentPath === parentPath}
            className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 disabled:opacity-30"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-1 text-xs font-mono text-zinc-500 whitespace-nowrap">
            {currentPath === '/' || (sep === '\\' && currentPath.length <= 3) ? (
              <span className="text-mint-green">{currentPath}</span>
            ) : (
              getPathParts().map((part, i, arr) => (
                <React.Fragment key={i}>
                  <span 
                    className="hover:text-mint-green cursor-pointer"
                    onClick={() => navigateToPart(i)}
                  >
                    {part}
                  </span>
                  {i < arr.length - 1 && <ChevronRight size={12} />}
                </React.Fragment>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar: Drives */}
          <div className="w-48 border-r border-zinc-800 overflow-y-auto p-2 bg-zinc-900/30">
            <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold px-2 mb-2">Locations</div>
            {drives.map((drive) => (
              <button
                key={drive.path}
                onClick={() => fetchDirectory(drive.path)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors mb-1 ${
                  currentPath.startsWith(drive.path) ? 'bg-mint-blue/10 text-mint-blue' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                <HardDrive size={16} />
                <span className="truncate">{drive.name}</span>
              </button>
            ))}
          </div>

          {/* Main Content: Folders */}
          <div className="flex-1 overflow-y-auto p-2 bg-zinc-900/10">
            {loading ? (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                Loading...
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1">
                {folders.length === 0 && (
                  <div className="p-8 text-center text-zinc-600 text-sm italic">
                    No folders found
                  </div>
                )}
                {folders.map((folder) => (
                  <button
                    key={folder.path}
                    onClick={() => fetchDirectory(folder.path)}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-zinc-800 group transition-all text-left"
                  >
                    <div className="p-2 bg-zinc-800 rounded-lg group-hover:bg-mint-purple/20 group-hover:text-mint-purple transition-colors">
                      <Folder size={18} />
                    </div>
                    <span className="text-sm text-zinc-300 group-hover:text-zinc-100 truncate">{folder.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
          <div className="text-xs text-zinc-500 truncate max-w-[60%]">
            Selected: <span className="text-zinc-300 font-mono">{currentPath}</span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onSelect(currentPath)}
              className="px-6 py-2 bg-mint-green hover:opacity-90 text-zinc-950 text-sm font-bold rounded-xl transition-all shadow-lg shadow-mint-green/20"
            >
              Select Folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
