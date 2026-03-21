import React, { useState, useMemo, useEffect } from 'react';
import { io } from 'socket.io-client';
import { 
  Search, 
  RefreshCw, 
  Trash2, 
  FolderSync, 
  HardDrive, 
  File, 
  ChevronRight, 
  ChevronDown,
  CheckCircle2, 
  AlertCircle, 
  ArrowRightLeft,
  Database,
  Info,
  X,
  Check,
  MoreVertical,
  Filter,
  Download,
  Copy,
  FolderOpen,
  Save,
  AlertTriangle,
  ExternalLink,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FileItem, DuplicateGroup, SyncDiff, SyncStats, Session } from './types';
import { FolderPicker } from './components/FolderPicker';

// Utility to format bytes
const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const TransferProgress = ({ total, current, message, isVisible }: { total: number; current: number; message: string; isVisible: boolean }) => {
  if (!isVisible) return null;
  const percentage = Math.round((current / total) * 100);
  
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-8 right-8 w-80 bg-mint-purple text-white p-6 shadow-2xl z-50 rounded-2xl border border-white/10"
    >
      <div className="flex justify-between items-end mb-4">
        <div className="flex-1 min-w-0">
          <h4 className="text-[10px] uppercase tracking-widest font-bold opacity-70">Transfer Progress</h4>
          <p className="text-lg font-serif italic truncate">{message}</p>
        </div>
        <div className="text-right ml-4">
          <span className="text-2xl font-serif italic font-bold">{percentage}%</span>
        </div>
      </div>
      
      <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          className="h-full bg-mint-green shadow-[0_0_10px_rgba(16,185,129,0.5)]"
        />
      </div>
      
      <div className="mt-3 flex justify-between text-[9px] uppercase tracking-widest opacity-70 font-bold">
        <span>{current} of {total} files</span>
        <span>{percentage === 100 ? 'Complete' : 'Processing...'}</span>
      </div>
    </motion.div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'duplicates' | 'sync'>('duplicates');
  const [isScanning, setIsScanning] = useState(false);
  
  // Duplicate Finder State
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [scanDir, setScanDir] = useState('');
  const [scannedDriveFreeSpace, setScannedDriveFreeSpace] = useState<number | null>(null);

  // Sync Tool State
  const [syncDiffs, setSyncDiffs] = useState<SyncDiff[]>([]);
  const [syncActions, setSyncActions] = useState<Record<number, string>>({});
  const [syncStats, setSyncStats] = useState<SyncStats | null>(null);
  const [selectedDiffs, setSelectedDiffs] = useState<Set<number>>(new Set());
  const [sourceDir, setSourceDir] = useState('');
  const [targetDir, setTargetDir] = useState('');
  const [scratchDiskPath, setScratchDiskPath] = useState('');

  const duplicateStats = useMemo(() => {
    let totalFiles = 0;
    let totalRedundantSize = 0;
    
    duplicateGroups.forEach(group => {
      // In each group, the first file is considered the "original", 
      // and the rest are duplicates.
      if (group.files.length > 1) {
        const duplicateCount = group.files.length - 1;
        totalFiles += duplicateCount;
        totalRedundantSize += group.files[0].size * duplicateCount;
      }
    });
    
    return {
      totalFiles,
      totalRedundantSize
    };
  }, [duplicateGroups]);

  useEffect(() => {
    // Fetch test paths from server
    fetch('/api/test-paths')
      .then(res => res.json())
      .then(data => {
        setScanDir(data.driveA);
        setSourceDir(data.driveA);
        setTargetDir(data.driveB);
        setScratchDiskPath(data.scratchDisk);
      })
      .catch(err => console.error('Failed to fetch test paths:', err));
  }, []);
  const [scratchFiles, setScratchFiles] = useState<any[]>([]);
  const [showScratchView, setShowScratchView] = useState(false);
  const [selectedScratchFiles, setSelectedScratchFiles] = useState<Set<string>>(new Set());
  const [wrapPaths, setWrapPaths] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionName, setSessionName] = useState('');
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, path: string } | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  const groupedDiffs: Record<string, number[]> = useMemo(() => {
    const groups: Record<string, number[]> = {};
    syncDiffs.forEach((diff, index) => {
      const parts = diff.relPath.split('/');
      const parent = parts.length > 1 ? parts.slice(0, -1).join('/') : 'Root';
      if (!groups[parent]) groups[parent] = [];
      groups[parent].push(index);
    });
    return groups;
  }, [syncDiffs]);

  const toggleFolderSelection = (indices: number[]) => {
    const selectableIndices = indices.filter(idx => syncDiffs[idx].type !== 'duplicate-content');
    const allSelected = selectableIndices.length > 0 && selectableIndices.every(idx => selectedDiffs.has(idx));
    const newSelection = new Set(selectedDiffs);
    
    if (allSelected) {
      selectableIndices.forEach(idx => newSelection.delete(idx));
    } else {
      selectableIndices.forEach(idx => newSelection.add(idx));
    }
    setSelectedDiffs(newSelection);
  };

  const toggleFolderExpansion = (folder: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folder)) newExpanded.delete(folder);
    else newExpanded.add(folder);
    setExpandedFolders(newExpanded);
  };

  // Progress State
  const [progress, setProgress] = useState<{ total: number; current: number; message: string; isVisible: boolean }>({
    total: 0,
    current: 0,
    message: '',
    isVisible: false
  });

  useEffect(() => {
    const socket = io();
    socket.on('scan-progress', (data) => {
      setProgress({
        total: data.total,
        current: data.current,
        message: data.message,
        isVisible: true
      });
    });
    socket.on('scan-status', (data) => {
      setProgress(prev => ({
        ...prev,
        message: data.message,
        isVisible: true
      }));
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, []);

  const fetchSessions = async () => {
    try {
      const response = await fetch('/api/list-sessions');
      const data = await response.json();
      setSessions(data);
    } catch (error) {
      console.error("Failed to fetch sessions");
    }
  };

  const fetchScratchFiles = async () => {
    if (!scratchDiskPath) return;
    try {
      const response = await fetch(`/api/list-scratch?scratchDiskPath=${encodeURIComponent(scratchDiskPath)}`);
      const data = await response.json();
      setScratchFiles(data);
    } catch (error) {
      console.error("Failed to fetch scratch files");
    }
  };

  useEffect(() => {
    if (activeTab === 'sync') {
      fetchScratchFiles();
    }
  }, [activeTab, scratchDiskPath]);

  const saveSession = async () => {
    if (!sessionName.trim()) {
      alert("Please enter a session name");
      return;
    }

    // Check if directories exist before saving
    if (!sourceDir || !targetDir) {
      const proceed = confirm("Source or Target drive is not set. Save & Load session anyway?");
      if (!proceed) return;
    }

    // Check for existing session with same name
    const existing = sessions.find(s => s.name.toLowerCase() === sessionName.toLowerCase());
    if (existing) {
      const overwrite = confirm(`A session named "${sessionName}" already exists. Overwrite?`);
      if (!overwrite) return;
    }

    const stateToSave = {
      duplicateGroups,
      syncDiffs,
      syncActions,
      selectedFiles: Array.from(selectedFiles),
      selectedDiffs: Array.from(selectedDiffs),
      selectedScratchFiles: Array.from(selectedScratchFiles),
      sourceDir,
      targetDir,
      scanDir,
      activeTab,
      scratchDiskPath
    };

    try {
      const response = await fetch('/api/save-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sessionName, state: stateToSave })
      });
      if (response.ok) {
        alert("Session saved successfully");
        setShowSessionModal(false);
        setSessionName('');
        fetchSessions();
      }
    } catch (error) {
      alert("Failed to save & load session");
    }
  };

  const loadSession = async (fileName: string) => {
    setIsLoadingSession(true);
    try {
      const response = await fetch(`/api/load-session?fileName=${fileName}`);
      const data = await response.json();
      
      if (data.missingPaths && data.missingPaths.length > 0) {
        alert(`Warning: The following paths from this session are missing or drives are disconnected:\n${data.missingPaths.join('\n')}`);
      }

      const { state } = data;
      setDuplicateGroups(state.duplicateGroups || []);
      setSyncDiffs(state.syncDiffs || []);
      setSyncActions(state.syncActions || {});
      setSelectedFiles(new Set<string>(state.selectedFiles || []));
      setSelectedDiffs(new Set<number>(state.selectedDiffs || []));
      setSelectedScratchFiles(new Set<string>(state.selectedScratchFiles || []));
      setSourceDir(state.sourceDir || '');
      setTargetDir(state.targetDir || '');
      setScanDir(state.scanDir || '');
      setScratchDiskPath(state.scratchDiskPath || '');
      setActiveTab(state.activeTab || 'duplicates');
      
      alert("Session loaded successfully");
      setShowSessionModal(false);
    } catch (error) {
      alert("Failed to load session");
    } finally {
      setIsLoadingSession(false);
    }
  };

  const deleteSession = async (fileName: string) => {
    if (!confirm("Are you sure you want to delete this session?")) return;
    
    try {
      const response = await fetch(`/api/delete-session?fileName=${fileName}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        fetchSessions();
      } else {
        alert("Failed to delete session");
      }
    } catch (error) {
      alert("Failed to delete session");
    }
  };

  // Folder Picker State
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'scan' | 'source' | 'target' | 'scratch' | null>(null);

  const openPicker = (target: 'scan' | 'source' | 'target' | 'scratch') => {
    setPickerTarget(target);
    setPickerOpen(true);
  };

  const handleFolderSelect = (path: string) => {
    if (pickerTarget === 'scan') setScanDir(path);
    else if (pickerTarget === 'source') setSourceDir(path);
    else if (pickerTarget === 'target') setTargetDir(path);
    else if (pickerTarget === 'scratch') setScratchDiskPath(path);
    setPickerOpen(false);
  };

  const handleStopScan = async () => {
    try {
      await fetch('/api/stop-scan', { method: 'POST' });
    } catch (error) {
      console.error("Failed to stop scan:", error);
    }
  };

  const handleScanDuplicates = async () => {
    if (isScanning) {
      handleStopScan();
      return;
    }
    setIsScanning(true);
    setDuplicateGroups([]);
    
    try {
      const response = await fetch('/api/scan-duplicates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directory: scanDir })
      });
      
      const data = await response.json();
      if (data.error) {
        alert(data.error);
      } else if (data.stopped) {
        console.log("Scan stopped by user");
        setScannedDriveFreeSpace(data.freeSpace || null);
        setProgress(prev => ({ ...prev, isVisible: false }));
      } else {
        setDuplicateGroups(data.duplicateGroups);
        setScannedDriveFreeSpace(data.freeSpace || null);
        setProgress(prev => ({ ...prev, isVisible: false }));
      }
    } catch (error) {
      console.error("Scan failed:", error);
      alert("Failed to connect to local scanner.");
      setProgress(prev => ({ ...prev, isVisible: false }));
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanSync = async () => {
    if (isScanning) {
      handleStopScan();
      return;
    }
    setIsScanning(true);
    setSyncDiffs([]);
    setSyncStats(null);
    setExpandedFolders(new Set());
    
    try {
      const response = await fetch('/api/scan-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceDir, targetDir, scratchDiskPath })
      });
      
      const data = await response.json();
      if (data.error) {
        alert(data.error);
      } else if (data.stopped) {
        console.log("Sync scan stopped by user");
        setProgress(prev => ({ ...prev, isVisible: false }));
      } else {
        setSyncDiffs(data.diffs);
        setSyncStats(data.stats);
        setProgress(prev => ({ ...prev, isVisible: false }));
      }
    } catch (error) {
      console.error("Sync scan failed:", error);
      alert("Failed to connect to local scanner.");
      setProgress(prev => ({ ...prev, isVisible: false }));
    } finally {
      setIsScanning(false);
    }
  };

  const handleSyncRenameMove = async (index: number, direction: 'AtoB' | 'BtoA') => {
    const diff = syncDiffs[index];
    if (!diff || diff.type !== 'duplicate-content') return;

    const targetFile = direction === 'AtoB' ? diff.fileB : diff.fileA;
    const targetBaseDir = direction === 'AtoB' ? targetDir : sourceDir;
    
    // The desired relative path is the one from the "source" of the sync
    const desiredRelPath = diff.relPath;
    const separator = targetBaseDir.includes('\\') ? '\\' : '/';
    const finalTargetPath = `${targetBaseDir}${targetBaseDir.endsWith('/') || targetBaseDir.endsWith('\\') ? '' : separator}${desiredRelPath}`;

    if (!targetFile) return;

    try {
      const response = await fetch('/api/sync-rename-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sourcePath: targetFile.path, 
          targetPath: finalTargetPath 
        })
      });

      const data = await response.json();
      if (data.error) {
        alert(data.error);
      } else {
        const newDiffs = [...syncDiffs];
        newDiffs.splice(index, 1);
        setSyncDiffs(newDiffs);
        
        const newActions = { ...syncActions };
        delete newActions[index];
        const shiftedActions: Record<number, string> = {};
        Object.entries(newActions).forEach(([key, val]) => {
          const k = parseInt(key);
          const action = val as string;
          if (k > index) {
            shiftedActions[k - 1] = action;
          } else {
            shiftedActions[k] = action;
          }
        });
        setSyncActions(shiftedActions);
      }
    } catch (error) {
      console.error("Rename/Move failed:", error);
      alert("Failed to rename/move file.");
    }
  };

  const handleDeleteSyncFile = async (filePath: string, index: number) => {
    if (!confirm(`Are you sure you want to permanently delete this file?\n\n${filePath}`)) return;
    
    try {
      const response = await fetch('/api/delete-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePaths: [filePath] })
      });
      
      const data = await response.json();
      if (data.error) {
        alert(data.error);
      } else {
        // Remove from syncDiffs
        const newDiffs = [...syncDiffs];
        newDiffs.splice(index, 1);
        setSyncDiffs(newDiffs);
        
        // Adjust syncActions
        const newActions = { ...syncActions };
        delete newActions[index];
        const shiftedActions: Record<number, string> = {};
        Object.entries(newActions).forEach(([key, val]) => {
          const k = parseInt(key);
          const action = val as string;
          if (k > index) {
            shiftedActions[k - 1] = action;
          } else {
            shiftedActions[k] = action;
          }
        });
        setSyncActions(shiftedActions);
      }
    } catch (error) {
      console.error("Delete failed:", error);
      alert("Failed to delete file.");
    }
  };

  const handleDeleteSelectedSync = async () => {
    if (selectedDiffs.size === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedDiffs.size} selected files?`)) return;
    
    const indices = (Array.from(selectedDiffs) as number[]).sort((a, b) => b - a);
    const filePaths = indices.map(idx => syncDiffs[idx].fileA?.path || syncDiffs[idx].fileB?.path).filter(Boolean) as string[];
    
    setProgress({ total: filePaths.length, current: 0, message: 'Deleting files...', isVisible: true });
    
    try {
      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i];
        const fileName = filePath.split('/').pop() || '';
        setProgress(prev => ({ ...prev, current: i, message: `Deleting ${fileName}` }));
        
        await fetch('/api/delete-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePaths: [filePath] })
        });
      }
      
      const newDiffs = [...syncDiffs];
      indices.forEach(idx => newDiffs.splice(idx, 1));
      setSyncDiffs(newDiffs);
      setSelectedDiffs(new Set());
      setSyncActions({});
      
      setProgress(prev => ({ ...prev, current: filePaths.length, message: 'Deletion complete' }));
      setTimeout(() => setProgress(prev => ({ ...prev, isVisible: false })), 2000);
      alert("Selected files deleted successfully.");
    } catch (error) {
      console.error("Bulk delete failed:", error);
      alert("Failed to delete some files.");
      setProgress(prev => ({ ...prev, isVisible: false }));
    }
  };

  const handleDeletePermanently = async () => {
    if (!confirm(`Are you sure you want to permanently delete ${selectedFiles.size} files?`)) return;
    const files = Array.from(selectedFiles) as string[];
    setProgress({ total: files.length, current: 0, message: 'Deleting files...', isVisible: true });
    
    try {
      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        const fileName = filePath.split('/').pop() || '';
        setProgress(prev => ({ ...prev, current: i, message: `Deleting ${fileName}` }));
        
        await fetch('/api/delete-files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePaths: [filePath] })
        });
      }
      
      setProgress(prev => ({ ...prev, current: files.length, message: 'Deletion complete' }));
      setTimeout(() => setProgress(prev => ({ ...prev, isVisible: false })), 2000);
      
      alert("Files deleted successfully.");
      setSelectedFiles(new Set());
      handleScanDuplicates();
    } catch (error) {
      alert("Failed to delete files.");
      setProgress(prev => ({ ...prev, isVisible: false }));
    }
  };

  const handleMoveToTrash = async () => {
    const files = Array.from(selectedFiles) as string[];
    setProgress({ total: files.length, current: 0, message: 'Moving to trash...', isVisible: true });
    
    try {
      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        const fileName = filePath.split('/').pop() || '';
        setProgress(prev => ({ ...prev, current: i, message: `Moving ${fileName}` }));
        
        await fetch('/api/move-to-trash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePaths: [filePath] })
        });
      }
      
      setProgress(prev => ({ ...prev, current: files.length, message: 'Trash move complete' }));
      setTimeout(() => setProgress(prev => ({ ...prev, isVisible: false })), 2000);
      
      alert("Files moved to MintSync_Trash folder.");
      setSelectedFiles(new Set());
      handleScanDuplicates();
    } catch (error) {
      alert("Failed to move files.");
      setProgress(prev => ({ ...prev, isVisible: false }));
    }
  };

  const handleExecuteSync = async () => {
    const operations = Array.from(selectedDiffs).map(index => {
      const diff = syncDiffs[index];
      const actionStr = syncActions[index] || (diff.type === 'missing-in-b' ? 'Mirror to B' : 'Mirror to A');
      
      let action: 'mirror-to-b' | 'mirror-to-a' | 'move-to-scratch' | 'ignore' = 'ignore';
      if (actionStr === 'Mirror to B') action = 'mirror-to-b';
      else if (actionStr === 'Mirror to A') action = 'mirror-to-a';
      else if (actionStr === 'Move to Scratch') action = 'move-to-scratch';

      if (action === 'ignore') return null;

      // Determine correct source path based on action
      let sourcePath = '';
      if (action === 'mirror-to-b') {
        sourcePath = diff.fileA?.path || '';
      } else if (action === 'mirror-to-a') {
        sourcePath = diff.fileB?.path || '';
      } else if (action === 'move-to-scratch') {
        // For scratch disk, we pick whichever file exists (or A if both exist)
        sourcePath = diff.fileA?.path || diff.fileB?.path || '';
      }

      if (!sourcePath) return null;

      return { 
        sourcePath, 
        relPath: diff.relPath,
        action 
      };
    }).filter(op => op !== null);

    if (operations.length === 0) return;

    // Check for free space warnings
    if (syncStats) {
      const mirrorToB = operations.some(op => op.action === 'mirror-to-b');
      const mirrorToA = operations.some(op => op.action === 'mirror-to-a');
      const moveToScratch = operations.some(op => op.action === 'move-to-scratch');

      let warningMsg = '';
      if (mirrorToB && syncStats.totalSizeToSync > syncStats.freeSpaceB) {
        warningMsg += `Warning: Drive B may not have enough space (${formatBytes(syncStats.freeSpaceB)} available, ${formatBytes(syncStats.totalSizeToSync)} needed).\n`;
      }
      if (mirrorToA && syncStats.totalSizeToSync > syncStats.freeSpaceA) {
        warningMsg += `Warning: Drive A may not have enough space (${formatBytes(syncStats.freeSpaceA)} available, ${formatBytes(syncStats.totalSizeToSync)} needed).\n`;
      }
      if (moveToScratch && syncStats.totalSizeToSync > syncStats.freeSpaceScratch) {
        warningMsg += `Warning: Scratch Disk may not have enough space (${formatBytes(syncStats.freeSpaceScratch)} available, ${formatBytes(syncStats.totalSizeToSync)} needed).\n`;
      }

      if (warningMsg && !confirm(`${warningMsg}\nDo you want to proceed anyway?`)) {
        return;
      }
    }

    setProgress({ total: operations.length, current: 0, message: 'Synchronizing drives...', isVisible: true });

    try {
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        const fileName = op.relPath.split('/').pop() || '';
        setProgress(prev => ({ ...prev, current: i, message: `Syncing ${fileName}` }));
        
        await fetch('/api/execute-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceDir, targetDir, operations: [op], scratchDiskPath })
        });
      }
      
      setProgress(prev => ({ ...prev, current: operations.length, message: 'Sync complete' }));
      setTimeout(() => setProgress(prev => ({ ...prev, isVisible: false })), 2000);
      
      alert("Sync completed successfully.");
      setSelectedDiffs(new Set());
      handleScanSync();
    } catch (error) {
      alert("Sync failed.");
      setProgress(prev => ({ ...prev, isVisible: false }));
    }
  };

  const handleStageInScratch = async () => {
    if (!scratchDiskPath) {
      alert("Please select a scratch disk path first.");
      return;
    }

    const operations = Array.from(selectedDiffs).map(index => {
      const diff = syncDiffs[index];
      const sourcePath = diff.fileA?.path || diff.fileB?.path;
      
      if (!sourcePath) return null;

      return { 
        sourcePath, 
        relPath: diff.relPath,
        action: 'move-to-scratch' as const
      };
    }).filter(op => op !== null);

    if (operations.length === 0) return;

    setProgress({ total: operations.length, current: 0, message: 'Moving to scratch disk...', isVisible: true });

    try {
      for (let i = 0; i < operations.length; i++) {
        const op = operations[i];
        const fileName = op.relPath.split('/').pop() || '';
        setProgress(prev => ({ ...prev, current: i, message: `Moving ${fileName}` }));
        
        await fetch('/api/execute-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceDir, targetDir, operations: [op], scratchDiskPath })
        });
      }
      
      setProgress(prev => ({ ...prev, current: operations.length, message: 'Move complete' }));
      setTimeout(() => setProgress(prev => ({ ...prev, isVisible: false })), 2000);
      
      alert("Files moved to scratch disk.");
      
      // Remove staged files from syncDiffs
      const remainingDiffs = syncDiffs.filter((_, idx) => !selectedDiffs.has(idx));
      setSyncDiffs(remainingDiffs);
      setSelectedDiffs(new Set());
      fetchScratchFiles();
    } catch (error) {
      alert("Move failed.");
      setProgress(prev => ({ ...prev, isVisible: false }));
    }
  };

  const handleSyncScratchToBoth = async () => {
    if (!scratchDiskPath || !sourceDir || !targetDir) return;
    
    const selectedIndices = Array.from(selectedScratchFiles).map(path => 
      scratchFiles.findIndex(f => f.path === path)
    ).filter(idx => idx !== -1);

    if (selectedIndices.length === 0) return;

    setProgress({ total: selectedIndices.length, current: 0, message: 'Syncing from scratch...', isVisible: true });

    try {
      for (let i = 0; i < selectedIndices.length; i++) {
        const file = scratchFiles[selectedIndices[i]];
        setProgress(prev => ({ ...prev, current: i, message: `Syncing ${file.name}` }));
        
        // Mirror to A
        await fetch('/api/execute-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sourceDir, 
            targetDir, 
            operations: [{ sourcePath: file.path, relPath: file.relPath, action: 'mirror-to-a' }],
            scratchDiskPath 
          })
        });

        // Mirror to B
        await fetch('/api/execute-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            sourceDir, 
            targetDir, 
            operations: [{ sourcePath: file.path, relPath: file.relPath, action: 'mirror-to-b' }],
            scratchDiskPath 
          })
        });
      }
      
      setProgress(prev => ({ ...prev, current: selectedIndices.length, message: 'Sync complete' }));
      setTimeout(() => setProgress(prev => ({ ...prev, isVisible: false })), 2000);
      alert("Files synced to both drives.");
      setSelectedScratchFiles(new Set());
    } catch (error) {
      alert("Sync failed.");
      setProgress(prev => ({ ...prev, isVisible: false }));
    }
  };

  const handleDeleteFromScratch = async () => {
    if (selectedScratchFiles.size === 0) return;
    if (!confirm(`Delete ${selectedScratchFiles.size} files from scratch disk permanently?`)) return;

    try {
      await fetch('/api/delete-from-scratch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: Array.from(selectedScratchFiles) })
      });
      alert("Files deleted from scratch disk.");
      setSelectedScratchFiles(new Set());
      fetchScratchFiles();
    } catch (error) {
      alert("Delete failed.");
    }
  };

  const toggleFileSelection = (id: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedFiles(newSelection);
  };

  const toggleDiffSelection = (index: number) => {
    const newSelection = new Set(selectedDiffs);
    if (newSelection.has(index)) newSelection.delete(index);
    else newSelection.add(index);
    setSelectedDiffs(newSelection);
  };

  const handleSelectAllDuplicates = () => {
    const allIds = duplicateGroups.flatMap(group => group.files.map(file => file.id));
    setSelectedFiles(new Set(allIds));
  };

  const handleClearSelectionDuplicates = () => {
    setSelectedFiles(new Set());
  };

  const handleSelectAllSync = () => {
    const allIndices = syncDiffs
      .map((diff, index) => diff.type !== 'duplicate-content' ? index : -1)
      .filter(idx => idx !== -1);
    setSelectedDiffs(new Set(allIndices));
  };

  const handleClearSelectionSync = () => {
    setSelectedDiffs(new Set());
  };

  const handleOpenFile = async (filePath: string) => {
    try {
      const response = await fetch('/api/open-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath })
      });
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to open file.");
      }
    } catch (error) {
      alert("Error opening file.");
    }
  };

  const handleOpenFolder = async (folderPath: string) => {
    try {
      const response = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath })
      });
      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to open folder.");
      }
    } catch (error) {
      alert("Error opening folder.");
    }
  };

  return (
    <div className={`min-h-screen bg-[#E4E3E0] dark:bg-zinc-950 text-[#141414] dark:text-zinc-100 font-sans selection:bg-[#141414] dark:selection:bg-zinc-100 selection:text-[#E4E3E0] dark:selection:text-zinc-950 transition-colors duration-300 ${isDarkMode ? 'dark' : ''}`}>
      {/* Sidebar / Navigation */}
      <div className="fixed left-0 top-0 h-full w-64 border-r border-[#141414] dark:border-zinc-800 bg-[#E4E3E0] dark:bg-zinc-900 z-10 hidden md:flex flex-col">
        <div className="p-8 border-bottom border-[#141414] flex items-center gap-4">
          <div className="w-12 h-12 flex-shrink-0">
            {/* Recreated User Logo as SVG */}
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-lg">
              <circle cx="50" cy="50" r="48" fill="#141414" />
              {/* Gear */}
              <path 
                d="M50 30c-11 0-20 9-20 20s9 20 20 20 20-9 20-20-9-20-20-20zm0 34c-7.7 0-14-6.3-14-14s6.3-14 14-14 14 6.3 14 14-6.3 14-14 14z" 
                fill="#A7F3D0" 
                opacity="0.8"
              />
              <path 
                d="M50 15l3 7h-6l3-7zM50 85l3-7h-6l3 7zM15 50l7-3v6l-7-3zM85 50l-7-3v6l7-3zM25 25l5 5-4 4-5-5 4-4zM75 75l-5-5 4-4 5 5-4 4zM25 75l5-5 4 4-5 5-4-4zM75 25l-5 5-4-4 5-5 4 4z" 
                fill="#A7F3D0"
              />
              {/* Arrows */}
              <path d="M35 65L65 35M65 35H55M65 35V45" stroke="#A7F3D0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M65 35L35 65M35 65H45M35 65V55" stroke="#A7F3D0" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
              {/* Magnifying Glass */}
              <circle cx="50" cy="50" r="12" fill="#141414" stroke="#A7F3D0" strokeWidth="3" />
              <path d="M58 58l8 8" stroke="#A7F3D0" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-serif italic tracking-tight leading-none">
              <span className="text-mint-purple">Mint</span>
              <span className="text-mint-blue">Sync</span>
            </h1>
            <p className="text-[10px] uppercase tracking-widest opacity-50 mt-1">Local File Utility</p>
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-2">
          <button 
            onClick={() => setActiveTab('duplicates')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm transition-all ${activeTab === 'duplicates' ? 'bg-mint-purple text-white shadow-lg translate-x-1' : 'hover:bg-mint-purple/10'}`}
          >
            <Copy size={18} className={activeTab === 'duplicates' ? 'text-white' : 'text-mint-purple'} />
            <span className="text-sm font-medium">Duplicate Finder</span>
          </button>
          <button 
            onClick={() => setActiveTab('sync')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm transition-all ${activeTab === 'sync' ? 'bg-mint-blue text-white shadow-lg translate-x-1' : 'hover:bg-mint-blue/10'}`}
          >
            <RefreshCw size={18} className={activeTab === 'sync' ? 'text-white' : 'text-mint-blue'} />
            <span className="text-sm font-medium">Drive Sync</span>
          </button>
        </nav>

        <div className="p-8 border-t border-[#141414] dark:border-zinc-800 space-y-4">
          <button 
            onClick={() => setShowSessionModal(true)}
            className="w-full flex items-center gap-3 px-4 py-2 border border-mint-purple text-mint-purple hover:bg-mint-purple hover:text-white transition-all text-[10px] uppercase tracking-widest font-bold"
          >
            <Save size={14} />
            <span>Save & Load Session</span>
          </button>
          
          <div className="flex items-center gap-3 opacity-50">
            <HardDrive size={16} className="text-mint-blue" />
            <span className="text-[10px] uppercase tracking-widest">Local Storage Only</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="md:ml-64 p-8 min-h-screen">
        <header className="flex justify-between items-end mb-12">
          <div className="flex items-end gap-8">
            <div>
              <h2 className={`text-4xl font-serif italic mb-2 relative inline-block`}>
                {activeTab === 'duplicates' ? 'Duplicate Analysis' : 'Mirror Sync'}
                <div className={`absolute -bottom-1 left-0 h-1 w-full ${activeTab === 'duplicates' ? 'bg-mint-purple' : 'bg-mint-blue'} opacity-30`} />
              </h2>
              <p className="text-sm opacity-60">
                {activeTab === 'duplicates' 
                  ? 'Scan and manage redundant files across your system locally.' 
                  : 'Synchronize two drives with intelligent scratch-disk management.'}
              </p>
            </div>

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-3 rounded-full border border-[#141414]/10 dark:border-white/10 hover:bg-[#141414]/5 dark:hover:bg-white/5 transition-all mb-1"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-mint-purple" />}
            </button>
          </div>
          
          <button 
            onClick={activeTab === 'duplicates' ? handleScanDuplicates : handleScanSync}
            className={`group relative px-8 py-3 ${isScanning ? 'bg-red-500' : (activeTab === 'duplicates' ? 'bg-mint-purple' : 'bg-mint-blue')} text-white text-sm font-medium overflow-hidden shadow-lg hover:scale-105 transition-transform`}
          >
            <span className="relative z-10 flex items-center gap-2">
              {isScanning ? <X size={16} /> : <Search size={16} />}
              {isScanning ? 'Stop Scan' : 'Start Scan'}
            </span>
          </button>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'duplicates' ? (
            <motion.div 
              key="duplicates"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="p-6 border border-[#141414] dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-4">
                <label className="text-[10px] uppercase tracking-widest opacity-50 whitespace-nowrap">Directory to Scan:</label>
                <div className="flex-1 flex items-center gap-2">
                  <div className="flex-1 px-4 py-2 border border-[#141414] dark:border-zinc-800 font-mono text-xs bg-[#141414]/5 dark:bg-white/5 truncate">
                    {scanDir || 'No directory selected'}
                  </div>
                  <button 
                    onClick={() => openPicker('scan')}
                    className="p-2 border border-[#141414] dark:border-zinc-800 hover:bg-[#141414] hover:text-[#E4E3E0] dark:hover:bg-zinc-100 dark:hover:text-zinc-950 transition-colors"
                    title="Browse"
                  >
                    <FolderOpen size={16} />
                  </button>
                </div>
              </div>

              {duplicateGroups.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-6"
                >
                  <div className="p-6 border border-mint-purple/20 bg-mint-purple/[0.03] dark:bg-mint-purple/[0.05] rounded-xl flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-mint-purple">
                      <Copy size={16} />
                      <span className="text-[10px] uppercase tracking-widest font-bold">Duplicates Found</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-serif italic font-bold">{duplicateStats.totalFiles}</span>
                      <span className="text-xs opacity-50">Redundant Files</span>
                    </div>
                  </div>

                  <div className="p-6 border border-emerald-500/20 bg-emerald-500/[0.03] dark:bg-emerald-500/[0.05] rounded-xl flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Trash2 size={16} />
                      <span className="text-[10px] uppercase tracking-widest font-bold">Potential Savings</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-serif italic font-bold text-emerald-600 dark:text-emerald-400">
                        {formatBytes(duplicateStats.totalRedundantSize)}
                      </span>
                      <span className="text-xs opacity-50">Disk Space</span>
                    </div>
                  </div>

                  <div className="p-6 border border-mint-blue/20 bg-mint-blue/[0.03] dark:bg-mint-blue/[0.05] rounded-xl flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-mint-blue">
                      <HardDrive size={16} />
                      <span className="text-[10px] uppercase tracking-widest font-bold">Drive Free Space</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-serif italic font-bold text-mint-blue">
                        {scannedDriveFreeSpace !== null ? formatBytes(scannedDriveFreeSpace) : '---'}
                      </span>
                      <span className="text-xs opacity-50">Available</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {duplicateGroups.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <h3 className="text-xl font-serif italic">Duplicate Groups</h3>
                    <div className="flex gap-4">
                      <button 
                        onClick={handleSelectAllDuplicates}
                        className="text-[10px] uppercase tracking-widest font-bold border-b border-mint-purple text-mint-purple hover:opacity-80 transition-opacity"
                      >
                        Select All
                      </button>
                      <button 
                        onClick={handleClearSelectionDuplicates}
                        className={`text-[10px] uppercase tracking-widest font-bold ${selectedFiles.size > 0 ? 'border-b border-mint-purple text-mint-purple hover:opacity-80' : 'opacity-40'} transition-opacity`}
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>
                  <div className="border border-[#141414]">
                  <div className={`grid ${wrapPaths ? 'grid-cols-[40px_2.5fr_1fr_1fr_1fr]' : 'grid-cols-[40px_1.5fr_1fr_1fr_1fr]'} p-4 border-b border-[#141414] bg-[#141414]/5`}>
                    <div className="col-header"></div>
                    <div className="col-header flex items-center gap-2">
                      File Name & Path
                      <button 
                        onClick={() => setWrapPaths(!wrapPaths)}
                        className={`text-[9px] px-1.5 py-0.5 border border-[#141414] transition-colors ${wrapPaths ? 'bg-[#141414] text-[#E4E3E0]' : 'hover:bg-[#141414]/5'}`}
                      >
                        {wrapPaths ? 'Compact' : 'Wrap'}
                      </button>
                    </div>
                    <div className="col-header">Size</div>
                    <div className="col-header">Modified</div>
                    <div className="col-header">Actions</div>
                  </div>
                  
                  {duplicateGroups.map((group, gIdx) => (
                    <div key={group.hash} className="border-b border-[#141414] last:border-0">
                      <div className="px-4 py-2 bg-mint-purple/5 text-[10px] uppercase tracking-widest font-bold flex justify-between text-mint-purple border-b border-mint-purple/10">
                        <span>Group {gIdx + 1} — SHA256: {group.hash.substring(0, 16)}...</span>
                        <span>{group.files.length} Duplicates</span>
                      </div>
                      {group.files.map(file => (
                        <div 
                          key={file.id} 
                          className={`grid ${wrapPaths ? 'grid-cols-[40px_2.5fr_1fr_1fr_1fr]' : 'grid-cols-[40px_1.5fr_1fr_1fr_1fr]'} p-4 transition-colors hover:bg-mint-purple/10 dark:hover:bg-mint-purple/20 group cursor-pointer ${selectedFiles.has(file.id) ? 'bg-mint-purple/20 dark:bg-mint-purple/30 border-l-4 border-mint-purple' : ''}`}
                          onClick={() => toggleFileSelection(file.id)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({ x: e.clientX, y: e.clientY, path: file.path });
                          }}
                        >
                          <div className="flex items-center justify-center">
                            <div className={`w-4 h-4 border border-current flex items-center justify-center ${selectedFiles.has(file.id) ? 'bg-mint-purple border-mint-purple' : 'text-[#141414] dark:text-zinc-100'}`}>
                              {selectedFiles.has(file.id) && <Check size={12} className="text-white" />}
                            </div>
                          </div>
                          <div className="flex flex-col overflow-hidden py-1">
                            <span className="font-medium truncate text-[#141414] dark:text-zinc-100">{file.name}</span>
                            <span className={`text-[10px] opacity-50 font-mono text-[#141414] dark:text-zinc-100 ${wrapPaths ? 'break-all whitespace-normal leading-tight mt-1' : 'truncate'}`}>
                              {file.path}
                            </span>
                          </div>
                          <div className="flex items-center font-mono text-xs text-[#141414] dark:text-zinc-100">{formatBytes(file.size)}</div>
                          <div className="flex items-center font-mono text-xs text-[#141414] dark:text-zinc-100">{new Date(file.lastModified).toLocaleDateString()}</div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenFile(file.path);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-mint-blue hover:bg-[#E4E3E0] dark:hover:bg-zinc-800 p-1 rounded text-[#141414] dark:text-zinc-100"
                              title="Open File"
                            >
                              <ExternalLink size={14} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const folderPath = file.path.substring(0, file.path.lastIndexOf(file.path.includes('\\') ? '\\' : '/'));
                                handleOpenFolder(folderPath);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-mint-blue hover:bg-[#E4E3E0] dark:hover:bg-zinc-800 p-1 rounded text-[#141414] dark:text-zinc-100"
                              title="Open Folder"
                            >
                              <FolderOpen size={14} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(file.path);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-[#141414] dark:hover:text-zinc-100 hover:bg-[#E4E3E0] dark:hover:bg-zinc-800 p-1 rounded text-[#141414] dark:text-zinc-100"
                              title="Copy Path"
                            >
                              <Copy size={14} />
                            </button>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 text-[#141414] dark:text-zinc-100">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : !isScanning && (
                <div className="h-64 border border-dashed border-[#141414]/30 flex flex-col items-center justify-center opacity-40">
                  <Copy size={48} strokeWidth={1} className="mb-4" />
                  <p className="text-sm font-serif italic">No duplicates found or scan not started.</p>
                </div>
              )}
              
              {selectedFiles.size > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="fixed bottom-8 left-1/2 -translate-x-1/2 md:left-[calc(50%+128px)] bg-mint-blue text-white px-8 py-4 flex items-center gap-8 shadow-2xl z-20 rounded-full"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-serif italic font-bold">{selectedFiles.size}</span>
                    <span className="text-[10px] uppercase tracking-widest opacity-80 font-bold">Files Selected</span>
                  </div>
                  <div className="h-8 w-px bg-white/20" />
                  <div className="flex gap-6">
                    <button 
                      onClick={handleDeletePermanently}
                      className="flex items-center gap-2 text-xs font-bold hover:text-red-200 transition-colors uppercase tracking-widest"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                    <button 
                      onClick={handleMoveToTrash}
                      className="flex items-center gap-2 text-xs font-bold hover:text-emerald-200 transition-colors uppercase tracking-widest"
                    >
                      <HardDrive size={14} /> Trash
                    </button>
                  </div>
                  <button onClick={() => setSelectedFiles(new Set())} className="hover:opacity-50 ml-2">
                    <X size={16} />
                  </button>
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="sync"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
              {/* Sync Configuration */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex flex-col gap-4 p-8 border border-[#141414] dark:border-zinc-800 bg-[#141414]/5 dark:bg-white/5 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2">
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-sm border border-emerald-200 dark:border-emerald-900/50">
                        <CheckCircle2 size={10} />
                        <span className="text-[8px] uppercase tracking-wider font-bold">Integrity Verification Active</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 w-full">
                      <label className="text-[10px] uppercase tracking-widest opacity-50 w-24 text-[#141414] dark:text-zinc-100">Source (A)</label>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 px-4 py-2 border border-[#141414] dark:border-zinc-800 font-mono text-xs bg-white dark:bg-zinc-900 text-[#141414] dark:text-zinc-100 truncate">
                          {sourceDir || 'Select Source'}
                        </div>
                        <button 
                          onClick={() => openPicker('source')}
                          className="p-2 border border-[#141414] dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[#141414] dark:text-zinc-100 hover:bg-[#141414] dark:hover:bg-zinc-100 hover:text-[#E4E3E0] dark:hover:text-zinc-900 transition-colors"
                        >
                          <FolderOpen size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 w-full">
                      <label className="text-[10px] uppercase tracking-widest opacity-50 w-24 text-[#141414] dark:text-zinc-100">Target (B)</label>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 px-4 py-2 border border-[#141414] dark:border-zinc-800 font-mono text-xs bg-white dark:bg-zinc-900 text-[#141414] dark:text-zinc-100 truncate">
                          {targetDir || 'Select Target'}
                        </div>
                        <button 
                          onClick={() => openPicker('target')}
                          className="p-2 border border-[#141414] dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[#141414] dark:text-zinc-100 hover:bg-[#141414] dark:hover:bg-zinc-100 hover:text-[#E4E3E0] dark:hover:text-zinc-900 transition-colors"
                        >
                          <FolderOpen size={16} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {syncStats && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-6 border border-mint-blue/20 bg-mint-blue/5 dark:bg-mint-blue/10">
                          <div className="flex justify-between items-start mb-2">
                            <label className="text-[10px] uppercase tracking-widest text-mint-blue font-bold">New for Drive A</label>
                            <span className="text-xs font-mono text-mint-blue font-bold">Size Needed: {formatBytes(syncStats.totalSizeForA)}</span>
                          </div>
                          <span className="text-3xl font-serif italic text-mint-blue">{syncStats.missingInA}</span>
                        </div>
                        <div className="p-6 border border-mint-purple/20 bg-mint-purple/5 dark:bg-mint-purple/10">
                          <div className="flex justify-between items-start mb-2">
                            <label className="text-[10px] uppercase tracking-widest text-mint-purple font-bold">New for Drive B</label>
                            <span className="text-xs font-mono text-mint-purple font-bold">Size Needed: {formatBytes(syncStats.totalSizeForB)}</span>
                          </div>
                          <span className="text-3xl font-serif italic text-mint-purple">{syncStats.missingInB}</span>
                        </div>
                        <div className="p-6 border border-mint-green/20 bg-mint-green text-white shadow-lg dark:shadow-mint-green/20">
                          <label className="text-[10px] uppercase tracking-widest opacity-80 block mb-2 font-bold">Total Non-Synced Files Size</label>
                          <span className="text-2xl font-mono font-bold">{formatBytes(syncStats.totalSizeToSync)}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className={`p-4 border ${syncStats.freeSpaceA < syncStats.totalSizeToSync ? 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900/40' : 'border-[#141414]/10 dark:border-zinc-800 bg-white dark:bg-zinc-900'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] uppercase tracking-widest opacity-50 font-bold">Drive A Free Space</label>
                            {syncStats.freeSpaceA < syncStats.totalSizeToSync && (
                              <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse">Low Space</span>
                            )}
                          </div>
                          <div className="flex items-end gap-2">
                            <span className={`text-xl font-mono ${syncStats.freeSpaceA < syncStats.totalSizeToSync ? 'text-red-600 dark:text-red-400' : 'text-[#141414] dark:text-zinc-100'}`}>
                              {formatBytes(syncStats.freeSpaceA)}
                            </span>
                            <span className="text-[10px] opacity-40 mb-1">Available</span>
                          </div>
                        </div>

                        <div className={`p-4 border ${syncStats.freeSpaceB < syncStats.totalSizeToSync ? 'border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900/40' : 'border-[#141414]/10 dark:border-zinc-800 bg-white dark:bg-zinc-900'}`}>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-[10px] uppercase tracking-widest opacity-50 font-bold">Drive B Free Space</label>
                            {syncStats.freeSpaceB < syncStats.totalSizeToSync && (
                              <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse">Low Space</span>
                            )}
                          </div>
                          <div className="flex items-end gap-2">
                            <span className={`text-xl font-mono ${syncStats.freeSpaceB < syncStats.totalSizeToSync ? 'text-red-600 dark:text-red-400' : 'text-[#141414] dark:text-zinc-100'}`}>
                              {formatBytes(syncStats.freeSpaceB)}
                            </span>
                            <span className="text-[10px] opacity-40 mb-1">Available</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-8 border border-[#141414] dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-6">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <Database size={18} />
                    <h3 className="text-sm font-bold uppercase tracking-widest">Scratch Disk Manager</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase tracking-widest opacity-50">Scratch Path</label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 px-4 py-2 border border-[#141414] dark:border-zinc-800 font-mono text-xs bg-[#141414]/5 dark:bg-white/5 truncate">
                          {scratchDiskPath}
                        </div>
                        <button 
                          onClick={() => openPicker('scratch')}
                          className="p-2 border border-[#141414] dark:border-zinc-800 hover:bg-[#141414] dark:hover:bg-zinc-100 hover:text-[#E4E3E0] dark:hover:text-zinc-900 transition-colors"
                        >
                          <FolderOpen size={16} />
                        </button>
                      </div>
                    </div>
                    
                    {syncStats && (
                      <div className="space-y-4">
                        <div className={`p-4 border ${syncStats.freeSpaceScratch < syncStats.scratchDiskNeeded ? 'border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900/40' : 'bg-mint-blue/5 dark:bg-mint-blue/10 border-mint-blue/20'} space-y-2`}>
                          <div className="flex items-center justify-between text-mint-blue">
                            <div className="flex items-center gap-2">
                              <Info size={14} />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Space Calculation</span>
                            </div>
                            {syncStats.freeSpaceScratch < syncStats.scratchDiskNeeded && (
                              <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full font-bold">Small Buffer</span>
                            )}
                          </div>
                          <p className="text-xs opacity-80 leading-relaxed">
                            Recommended: <strong className="text-mint-blue">{formatBytes(syncStats.scratchDiskNeeded)}</strong>
                          </p>
                          <div className="pt-2 border-t border-current/10 flex justify-between items-end">
                            <label className="text-[9px] uppercase tracking-widest opacity-50">Available on Scratch</label>
                            <span className={`text-sm font-mono font-bold ${syncStats.freeSpaceScratch < syncStats.scratchDiskNeeded ? 'text-amber-700 dark:text-amber-400' : 'text-mint-blue'}`}>
                              {formatBytes(syncStats.freeSpaceScratch)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Diff List */}
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-6">
                    <h3 className="text-xl font-serif italic">
                      {showScratchView ? 'Scratch Disk Contents' : 'Synchronization Queue'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setShowScratchView(!showScratchView);
                          fetchScratchFiles();
                        }}
                        className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-all ${
                          scratchFiles.length > 0 
                            ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50' 
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border border-zinc-200 dark:border-zinc-700'
                        }`}
                      >
                        <Database size={12} />
                        {scratchFiles.length > 0 ? 'Scratch is Loaded' : 'Scratch is Empty'}
                        <div className={`w-2 h-2 rounded-full ${scratchFiles.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-zinc-300 dark:bg-zinc-600'}`} />
                      </button>
                      <button 
                        onClick={fetchScratchFiles}
                        className="p-1.5 rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 transition-colors"
                        title="Refresh Scratch Disk"
                      >
                        <RefreshCw size={12} />
                      </button>
                    </div>
                  </div>
                  
                  {!showScratchView ? (
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setExpandedFolders(new Set(Object.keys(groupedDiffs)))}
                        className="text-[10px] uppercase tracking-widest font-bold border-b border-[#141414]/40 dark:border-zinc-100/40 text-[#141414]/60 dark:text-zinc-100/60 hover:text-[#141414] dark:hover:text-zinc-100 transition-colors"
                      >
                        Expand All
                      </button>
                      <button 
                        onClick={() => setExpandedFolders(new Set())}
                        className="text-[10px] uppercase tracking-widest font-bold border-b border-[#141414]/40 dark:border-zinc-100/40 text-[#141414]/60 dark:text-zinc-100/60 hover:text-[#141414] dark:hover:text-zinc-100 transition-colors"
                      >
                        Collapse All
                      </button>
                      <div className="w-px h-4 bg-[#141414]/10 dark:bg-white/10 self-center" />
                      <button 
                        onClick={handleSelectAllSync}
                        className="text-[10px] uppercase tracking-widest font-bold border-b border-mint-blue text-mint-blue hover:opacity-80 transition-opacity"
                      >
                        Select All
                      </button>
                      <button 
                        onClick={handleClearSelectionSync}
                        className={`text-[10px] uppercase tracking-widest font-bold ${selectedDiffs.size > 0 ? 'border-b border-mint-blue text-mint-blue hover:opacity-80' : 'opacity-40'} transition-opacity`}
                      >
                        Clear Selection
                      </button>
                      {selectedDiffs.size > 0 && (
                        <button 
                          onClick={handleDeleteSelectedSync}
                          className="text-[10px] uppercase tracking-widest font-bold border-b border-red-500 text-red-500 hover:opacity-80 transition-opacity"
                        >
                          Delete Selected
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-4">
                      <button 
                        onClick={() => setSelectedScratchFiles(new Set(scratchFiles.map(f => f.path)))}
                        className="text-[10px] uppercase tracking-widest font-bold border-b border-amber-600 text-amber-600 hover:opacity-80 transition-opacity"
                      >
                        Select All
                      </button>
                      <button 
                        onClick={() => setSelectedScratchFiles(new Set())}
                        className={`text-[10px] uppercase tracking-widest font-bold ${selectedScratchFiles.size > 0 ? 'border-b border-amber-600 text-amber-600 hover:opacity-80' : 'opacity-40'} transition-opacity`}
                      >
                        Clear Selection
                      </button>
                    </div>
                  )}
                </div>

                {showScratchView ? (
                  <div className="border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/10">
                    <div className={`grid ${wrapPaths ? 'grid-cols-[40px_2fr_1fr_1fr_80px]' : 'grid-cols-[40px_1.5fr_1fr_1fr_80px]'} p-4 border-b border-amber-200 dark:border-amber-900/50 bg-amber-100/50 dark:bg-amber-900/20`}>
                      <div className="col-header"></div>
                      <div className="col-header">File Name & Path</div>
                      <div className="col-header">Size</div>
                      <div className="col-header">Modified</div>
                      <div className="col-header">Actions</div>
                    </div>
                    {scratchFiles.length > 0 ? (
                      scratchFiles.map((file, idx) => (
                        <div 
                          key={file.path}
                          className={`grid ${wrapPaths ? 'grid-cols-[40px_2fr_1fr_1fr_80px]' : 'grid-cols-[40px_1.5fr_1fr_1fr_80px]'} p-4 border-b border-amber-100 dark:border-amber-900/20 last:border-0 transition-colors hover:bg-amber-100/30 dark:hover:bg-amber-900/30 group cursor-pointer ${selectedScratchFiles.has(file.path) ? 'bg-amber-100/50 dark:bg-amber-900/40 border-l-4 border-amber-500' : ''}`}
                          onClick={() => {
                            const newSelection = new Set(selectedScratchFiles);
                            if (newSelection.has(file.path)) newSelection.delete(file.path);
                            else newSelection.add(file.path);
                            setSelectedScratchFiles(newSelection);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setContextMenu({ x: e.clientX, y: e.clientY, path: file.path });
                          }}
                        >
                          <div className="flex items-center justify-center">
                            <div className={`w-4 h-4 border border-current flex items-center justify-center ${selectedScratchFiles.has(file.path) ? 'bg-amber-500 border-amber-500' : ''}`}>
                              {selectedScratchFiles.has(file.path) && <Check size={12} className="text-white" />}
                            </div>
                          </div>
                          <div className="flex flex-col overflow-hidden py-1">
                            <span className="font-medium truncate">{file.name}</span>
                            <span className={`text-[10px] opacity-50 font-mono ${wrapPaths ? 'break-all whitespace-normal leading-tight mt-1' : 'truncate'}`}>
                              {file.relPath}
                            </span>
                          </div>
                          <div className="flex items-center font-mono text-xs">{formatBytes(file.size)}</div>
                          <div className="flex items-center font-mono text-xs">{new Date(file.lastModified).toLocaleDateString()}</div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenFile(file.path);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-amber-600 hover:bg-amber-100 p-1 rounded"
                              title="Open File"
                            >
                              <ExternalLink size={14} />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const folderPath = file.path.substring(0, file.path.lastIndexOf(file.path.includes('\\') ? '\\' : '/'));
                                handleOpenFolder(folderPath);
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-amber-600 hover:bg-amber-100 p-1 rounded"
                              title="Open Folder"
                            >
                              <FolderOpen size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-12 text-center opacity-40 italic">Scratch disk is empty.</div>
                    )}
                  </div>
                ) : syncDiffs.length > 0 ? (
                  <div className="border border-[#141414] dark:border-zinc-800">
                    <div className={`grid ${wrapPaths ? 'grid-cols-[40px_1fr_2fr_1fr_1.5fr]' : 'grid-cols-[40px_1fr_1fr_1fr_1.5fr]'} p-4 border-b border-[#141414] dark:border-zinc-800 bg-[#141414]/5 dark:bg-white/5`}>
                      <div className="col-header"></div>
                      <div className="col-header">Status</div>
                      <div className="col-header flex items-center gap-2">
                        File Name
                        <button 
                          onClick={() => setWrapPaths(!wrapPaths)}
                          className={`text-[9px] px-1.5 py-0.5 border border-[#141414] dark:border-zinc-800 transition-colors ${wrapPaths ? 'bg-[#141414] dark:bg-zinc-100 text-[#E4E3E0] dark:text-zinc-950' : 'hover:bg-[#141414]/5 dark:hover:bg-white/5'}`}
                        >
                          {wrapPaths ? 'Compact' : 'Wrap'}
                        </button>
                      </div>
                      <div className="col-header">Size</div>
                      <div className="col-header">Action Staging</div>
                    </div>

                    {Object.entries(groupedDiffs).map(([folder, indices]) => {
                      const isExpanded = expandedFolders.has(folder);
                      const allSelected = indices.every(idx => selectedDiffs.has(idx));
                      const someSelected = !allSelected && indices.some(idx => selectedDiffs.has(idx));
                      
                      return (
                        <div key={folder} className="border-b border-[#141414] dark:border-zinc-800 last:border-0">
                          {/* Folder Header */}
                          <div 
                            className={`flex items-center gap-4 p-3 bg-[#141414]/[0.02] dark:bg-white/[0.02] hover:bg-[#141414]/[0.05] dark:hover:bg-white/[0.05] cursor-pointer transition-colors`}
                            onClick={() => toggleFolderExpansion(folder)}
                          >
                            <div 
                              className="flex items-center justify-center w-6 h-6 hover:bg-[#141414]/10 dark:hover:bg-white/10 rounded transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFolderExpansion(folder);
                              }}
                            >
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </div>
                            
                            <div 
                              className="flex items-center justify-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFolderSelection(indices);
                              }}
                            >
                              <div className={`w-4 h-4 border border-current flex items-center justify-center ${allSelected ? 'bg-mint-purple border-mint-purple' : someSelected ? 'bg-mint-purple/40 border-mint-purple' : ''}`}>
                                {allSelected && <Check size={12} className="text-white" />}
                                {someSelected && <div className="w-2 h-0.5 bg-white" />}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <FolderOpen size={16} className="text-mint-blue shrink-0" />
                              <span className="font-serif italic font-bold text-sm truncate">{folder}</span>
                              <span className="text-[10px] opacity-40 font-mono">({indices.length} files)</span>
                            </div>
                          </div>

                          {/* Folder Contents */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="overflow-hidden bg-white dark:bg-zinc-900"
                              >
                                {indices.map((index) => {
                                  const diff = syncDiffs[index];
                                  return (
                                    <div 
                                      key={index}
                                      className={`grid ${wrapPaths ? 'grid-cols-[40px_1fr_2fr_1fr_1.5fr]' : 'grid-cols-[40px_1fr_1fr_1fr_1.5fr]'} p-4 border-t border-[#141414]/10 dark:border-zinc-800 transition-colors hover:bg-mint-purple/10 group cursor-pointer ${selectedDiffs.has(index) ? 'bg-mint-purple/20 border-l-4 border-mint-purple' : ''}`}
                                      onClick={() => toggleDiffSelection(index)}
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        const path = diff.fileA?.path || diff.fileB?.path;
                                        if (path) setContextMenu({ x: e.clientX, y: e.clientY, path });
                                      }}
                                    >
                                      <div className="flex items-center justify-center">
                                        <div className={`w-4 h-4 border border-current flex items-center justify-center ${selectedDiffs.has(index) ? 'bg-mint-purple border-mint-purple' : ''}`}>
                                          {selectedDiffs.has(index) && <Check size={12} className="text-white" />}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {diff.type === 'missing-in-b' && <span className="text-[11px] px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 rounded-full font-bold uppercase">New for B</span>}
                                        {diff.type === 'missing-in-a' && <span className="text-[11px] px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full font-bold uppercase">New for A</span>}
                                        {diff.type === 'different-version' && <span className="text-[11px] px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded-full font-bold uppercase">Modified</span>}
                                        {diff.type === 'duplicate-content' && (
                                          <span className="text-[11px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 rounded-full font-bold uppercase">
                                            Already Present on {diff.presentOn || 'Other Drive'}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex flex-col overflow-hidden py-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium truncate">{diff.fileA?.name || diff.fileB?.name}</span>
                                          {diff.type === 'duplicate-content' && (
                                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold italic">
                                              (Duplicate content found on both drives)
                                            </span>
                                          )}
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const path = diff.fileA?.path || diff.fileB?.path;
                                              if (path) handleOpenFile(path);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-mint-blue p-1 rounded"
                                            title="Open File"
                                          >
                                            <ExternalLink size={12} />
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const path = diff.fileA?.path || diff.fileB?.path;
                                              if (path) {
                                                const folderPath = path.substring(0, path.lastIndexOf(path.includes('\\') ? '\\' : '/'));
                                                handleOpenFolder(folderPath);
                                              }
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-mint-blue p-1 rounded"
                                            title="Open Folder"
                                          >
                                            <FolderOpen size={12} />
                                          </button>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const path = diff.fileA?.path || diff.fileB?.path;
                                              if (path) handleDeleteSyncFile(path, index);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 p-1 rounded"
                                            title="Delete File Permanently"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                        
                                        {diff.type === 'duplicate-content' ? (
                                          <div className="mt-1 flex flex-col gap-0.5">
                                            <div className={`flex gap-2 text-[11px] font-mono ${wrapPaths ? 'items-start' : 'items-center'}`}>
                                              <span className="font-bold text-mint-purple opacity-70 w-14 shrink-0">DRIVE A:</span>
                                              <span className={`opacity-60 ${wrapPaths ? 'break-all whitespace-normal leading-tight' : 'truncate'}`}>{diff.fileA?.path}</span>
                                            </div>
                                            <div className={`flex gap-2 text-[11px] font-mono ${wrapPaths ? 'items-start' : 'items-center'}`}>
                                              <span className="font-bold text-mint-blue opacity-70 w-14 shrink-0">DRIVE B:</span>
                                              <span className={`opacity-60 ${wrapPaths ? 'break-all whitespace-normal leading-tight' : 'truncate'}`}>{diff.fileB?.path}</span>
                                            </div>
                                          </div>
                                        ) : (
                                          <span className={`text-[11px] opacity-60 font-mono ${wrapPaths ? 'break-all whitespace-normal leading-tight mt-1' : 'truncate'}`}>
                                            {diff.relPath}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center font-mono text-xs">
                                        {formatBytes(diff.fileA?.size || diff.fileB?.size || 0)}
                                      </div>
                                      <div className="flex items-center gap-4">
                                        {diff.type === 'duplicate-content' ? (
                                          <div className="flex gap-2">
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSyncRenameMove(index, 'AtoB');
                                              }}
                                              className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 bg-mint-purple text-white hover:bg-mint-purple/80 transition-colors rounded"
                                              title="Rename/Move on B to match A"
                                            >
                                              Sync B to A
                                            </button>
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleSyncRenameMove(index, 'BtoA');
                                              }}
                                              className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 bg-mint-blue text-white hover:bg-mint-blue/80 transition-colors rounded"
                                              title="Rename/Move on A to match B"
                                            >
                                              Sync A to B
                                            </button>
                                          </div>
                                        ) : (
                                          <select 
                                            value={syncActions[index] || (diff.type === 'missing-in-b' ? 'Mirror to B' : 'Mirror to A')}
                                            onChange={(e) => {
                                              setSyncActions({ ...syncActions, [index]: e.target.value });
                                            }}
                                            className="bg-transparent border border-current/20 text-[10px] uppercase tracking-widest px-2 py-1 focus:outline-none"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <option className="bg-[#E4E3E0] dark:bg-zinc-800 text-[#141414] dark:text-zinc-100">Mirror to B</option>
                                            <option className="bg-[#E4E3E0] dark:bg-zinc-800 text-[#141414] dark:text-zinc-100">Mirror to A</option>
                                            <option className="bg-[#E4E3E0] dark:bg-zinc-800 text-[#141414] dark:text-zinc-100">Move to Scratch</option>
                                            <option className="bg-[#E4E3E0] dark:bg-zinc-800 text-[#141414] dark:text-zinc-100">Ignore</option>
                                          </select>
                                        )}
                                        <div className="text-[10px] opacity-50 font-mono truncate">
                                          From: {diff.fileA ? 'Drive A' : 'Drive B'}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                ) : !isScanning && (
                  <div className="h-64 border border-dashed border-[#141414]/30 dark:border-zinc-100/20 flex flex-col items-center justify-center opacity-40">
                    <FolderSync size={48} strokeWidth={1} className="mb-4" />
                    <p className="text-sm font-serif italic">Scan drives to compare file structures.</p>
                  </div>
                )}
              </div>

              {selectedDiffs.size > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="fixed bottom-8 left-1/2 -translate-x-1/2 md:left-[calc(50%+128px)] bg-mint-purple text-white px-8 py-4 flex items-center gap-8 shadow-2xl z-20 rounded-full"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-serif italic font-bold">{selectedDiffs.size}</span>
                    <span className="text-[10px] uppercase tracking-widest opacity-80 font-bold">Diffs Selected</span>
                  </div>
                  <div className="h-8 w-px bg-white/20" />
                  <div className="flex gap-6">
                    <button 
                      onClick={handleExecuteSync}
                      className="flex items-center gap-2 text-xs font-bold hover:text-emerald-200 transition-colors uppercase tracking-widest"
                    >
                      <RefreshCw size={14} /> Execute Sync
                    </button>
                    <button 
                      onClick={handleStageInScratch}
                      className="flex items-center gap-2 text-xs font-bold hover:text-amber-200 transition-colors uppercase tracking-widest"
                    >
                      <Database size={14} /> Move to Scratch Disk
                    </button>
                  </div>
                  <button onClick={() => setSelectedDiffs(new Set())} className="hover:opacity-50 ml-2">
                    <X size={16} />
                  </button>
                </motion.div>
              )}

              {selectedScratchFiles.size > 0 && showScratchView && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="fixed bottom-8 left-1/2 -translate-x-1/2 md:left-[calc(50%+128px)] bg-amber-600 text-white px-8 py-4 flex items-center gap-8 shadow-2xl z-20 rounded-full"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-serif italic font-bold">{selectedScratchFiles.size}</span>
                    <span className="text-[10px] uppercase tracking-widest opacity-80 font-bold">Files Selected</span>
                  </div>
                  <div className="h-8 w-px bg-white/20" />
                  <div className="flex gap-6">
                    <button 
                      onClick={handleSyncScratchToBoth}
                      className="flex items-center gap-2 text-xs font-bold hover:text-emerald-200 transition-colors uppercase tracking-widest"
                    >
                      <RefreshCw size={14} /> Sync to Both
                    </button>
                    <button 
                      onClick={handleDeleteFromScratch}
                      className="flex items-center gap-2 text-xs font-bold hover:text-red-200 transition-colors uppercase tracking-widest"
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                  <button onClick={() => setSelectedScratchFiles(new Set())} className="hover:opacity-50 ml-2">
                    <X size={16} />
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Global CSS for visible grid borders */}
      <style dangerouslySetInnerHTML={{ __html: `
        .col-header {
          font-family: 'Georgia', serif;
          font-style: italic;
          font-size: 11px;
          opacity: 0.5;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      `}} />
      {/* Folder Picker Modal */}
      <FolderPicker 
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handleFolderSelect}
        title={`Select ${pickerTarget === 'scan' ? 'Directory to Scan' : pickerTarget === 'source' ? 'Source Drive' : pickerTarget === 'target' ? 'Target Drive' : 'Scratch Disk'}`}
      />

      {/* Session Modal */}
      <AnimatePresence>
        {showSessionModal && (
          <div className="fixed inset-0 bg-[#141414]/90 dark:bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#E4E3E0] dark:bg-zinc-900 w-full max-w-2xl border border-[#141414] dark:border-zinc-800 shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-[#141414] dark:border-zinc-800 flex justify-between items-center">
                <h2 className="text-2xl font-serif italic text-[#141414] dark:text-zinc-100">Session Management</h2>
                <button onClick={() => setShowSessionModal(false)} className="opacity-50 hover:opacity-100 text-[#141414] dark:text-zinc-100">
                  <X size={24} />
                </button>
              </div>
              
              <div className="p-8 space-y-8">
                {/* Drive Connectivity Warning */}
                {(!sourceDir || !targetDir) && (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10px] uppercase tracking-widest font-bold flex items-center gap-3">
                    <AlertTriangle size={14} />
                    <span>Warning: Source or Target drive not currently selected.</span>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold opacity-50 text-[#141414] dark:text-zinc-100">Save Current State</h3>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={sessionName}
                      onChange={(e) => setSessionName(e.target.value)}
                      placeholder="Enter session name (e.g., 'Drive A Cleanup')"
                      className="flex-1 bg-transparent border border-[#141414] dark:border-zinc-800 px-4 py-2 font-serif italic focus:outline-none text-[#141414] dark:text-zinc-100"
                    />
                    <button 
                      onClick={saveSession}
                      className="px-6 py-2 bg-mint-purple text-white text-[10px] uppercase tracking-widest font-bold hover:opacity-90 transition-opacity"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] uppercase tracking-widest font-bold opacity-50 text-[#141414] dark:text-zinc-100">Load Previous Session</h3>
                  <div className="max-h-64 overflow-y-auto border border-[#141414] dark:border-zinc-800">
                    {sessions.length > 0 ? (
                      sessions.map((session) => (
                        <div 
                          key={session.id} 
                          className="p-4 border-b border-[#141414] dark:border-zinc-800 last:border-0 flex justify-between items-center hover:bg-[#141414]/5 dark:hover:bg-white/5 transition-colors group"
                        >
                          <div>
                            <p className="font-serif italic text-lg text-[#141414] dark:text-zinc-100">{session.name}</p>
                            <p className="text-[10px] opacity-50 uppercase tracking-widest text-[#141414] dark:text-zinc-100">
                              {new Date(session.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => loadSession(session.id)}
                              disabled={isLoadingSession}
                              className="px-4 py-1 border border-mint-purple text-mint-purple text-[10px] uppercase tracking-widest font-bold hover:bg-mint-purple hover:text-white transition-all disabled:opacity-50"
                            >
                              {isLoadingSession ? 'Loading...' : 'Load'}
                            </button>
                            <button 
                              onClick={() => deleteSession(session.id)}
                              className="p-1.5 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                              title="Delete Session"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center opacity-40 italic text-[#141414] dark:text-zinc-100">No saved sessions found.</div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <TransferProgress {...progress} />
      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 min-w-[160px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              handleOpenFile(contextMenu.path);
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 flex items-center gap-2"
          >
            <ExternalLink size={14} />
            Open File
          </button>
          <button
            onClick={() => {
              const folderPath = contextMenu.path.split(/[/\\]/).slice(0, -1).join('/');
              handleOpenFolder(folderPath);
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 flex items-center gap-2"
          >
            <FolderOpen size={14} />
            Open Folder
          </button>
          <div className="h-px bg-slate-100 dark:bg-zinc-700 my-1" />
          <button
            onClick={() => {
              navigator.clipboard.writeText(contextMenu.path);
              setContextMenu(null);
            }}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-700 flex items-center gap-2"
          >
            <Copy size={14} />
            Copy Path
          </button>
        </div>
      )}
    </div>
  );
}
