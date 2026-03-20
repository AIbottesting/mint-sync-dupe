import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to get file hash (SHA-256)
function getFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

// Helper to recursively walk directories
async function walkDir(dir: string, fileList: any[] = []) {
  try {
    const files = await fs.promises.readdir(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const stat = await fs.promises.stat(filePath);
        if (stat.isDirectory()) {
          await walkDir(filePath, fileList);
        } else {
          fileList.push({
            id: filePath,
            name: file,
            path: filePath,
            size: stat.size,
            type: path.extname(file) || 'unknown',
            lastModified: stat.mtime.toISOString(),
          });
        }
      } catch (e) {
        // Skip files we can't access due to permissions
      }
    }
  } catch (e) {
    console.error(`Error reading directory ${dir}:`, e);
  }
  return fileList;
}

// Create dummy directories for testing in the preview environment
function setupTestDirectories() {
  const tempDir = os.tmpdir();
  const driveA = path.join(tempDir, 'drive_a');
  const driveB = path.join(tempDir, 'drive_b');
  
  if (!fs.existsSync(driveA)) fs.mkdirSync(driveA, { recursive: true });
  if (!fs.existsSync(driveB)) fs.mkdirSync(driveB, { recursive: true });

  fs.writeFileSync(path.join(driveA, 'hello.txt'), 'Hello World!');
  fs.writeFileSync(path.join(driveA, 'duplicate1.txt'), 'This is a duplicate file content.');
  fs.writeFileSync(path.join(driveA, 'duplicate2.txt'), 'This is a duplicate file content.');
  fs.writeFileSync(path.join(driveA, 'unique_a.txt'), 'Only in A');

  fs.writeFileSync(path.join(driveB, 'hello.txt'), 'Hello World! Modified in B');
  fs.writeFileSync(path.join(driveB, 'unique_b.txt'), 'Only in B');
  fs.writeFileSync(path.join(driveB, 'duplicate1.txt'), 'This is a duplicate file content.');
}

async function moveFile(src: string, dest: string) {
  try {
    await fs.promises.rename(src, dest);
  } catch (error: any) {
    if (error.code === 'EXDEV') {
      // Cross-device move: copy and then delete
      await fs.promises.copyFile(src, dest);
      await fs.promises.unlink(src);
    } else {
      throw error;
    }
  }
}

async function startServer() {
  setupTestDirectories();

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API: Get test paths for the preview environment
  app.get("/api/test-paths", (req, res) => {
    const tempDir = os.tmpdir();
    res.json({
      driveA: path.join(tempDir, 'drive_a'),
      driveB: path.join(tempDir, 'drive_b'),
      scratchDisk: path.join(tempDir, 'scratch_disk')
    });
  });
  
  // API: List directory contents for folder picker
  app.get("/api/list-directory", async (req, res) => {
    try {
      const dirPath = (req.query.path as string) || os.homedir();
      if (!fs.existsSync(dirPath)) {
        return res.status(404).json({ error: "Directory not found" });
      }
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      const folders = entries
        .filter(entry => entry.isDirectory())
        .map(entry => ({ name: entry.name, path: path.join(dirPath, entry.name) }))
        .sort((a, b) => a.name.localeCompare(b.name));

      res.json({
        currentPath: dirPath,
        parentPath: path.dirname(dirPath),
        folders,
        sep: path.sep
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: Get system drives (Windows/Linux/macOS)
  app.get("/api/list-drives", async (req, res) => {
    try {
      const drives: any[] = [];
      
      if (process.platform === 'win32') {
        // On Windows, list logical drives
        const driveLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for (const char of driveLetters) {
          const drivePath = `${char}:\\`;
          try {
            if (fs.existsSync(drivePath)) {
              drives.push({ name: `Local Disk (${char}:)`, path: drivePath });
            }
          } catch (e) {
            // Ignore drives that are not ready or accessible
          }
        }
      } else {
        // On Unix-like systems
        drives.push({ name: 'Root (/)', path: '/' });
        
        // External drives in /media or /mnt
        const mountPoints = ['/media', '/mnt', '/Volumes']; // /Volumes for macOS
        for (const mp of mountPoints) {
          if (fs.existsSync(mp)) {
            try {
              const entries = await fs.promises.readdir(mp, { withFileTypes: true });
              entries.filter(e => e.isDirectory()).forEach(e => {
                drives.push({ name: `${e.name}`, path: path.join(mp, e.name) });
              });
            } catch (e) {}
          }
        }
      }

      // Always add Home
      drives.push({ name: 'Home', path: os.homedir() });

      res.json(drives);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: Scan for duplicates
  app.post("/api/scan-duplicates", async (req, res) => {
    try {
      const { directory } = req.body;
      if (!fs.existsSync(directory)) {
        return res.status(400).json({ error: "Directory does not exist" });
      }

      const allFiles = await walkDir(directory);
      
      // Group by size first (optimization)
      const sizeGroups: Record<number, any[]> = {};
      for (const f of allFiles) {
        if (!sizeGroups[f.size]) sizeGroups[f.size] = [];
        sizeGroups[f.size].push(f);
      }

      const duplicateGroups = [];
      
      // Only hash files that have the same size
      for (const size in sizeGroups) {
        const files = sizeGroups[size];
        if (files.length > 1) {
          const hashGroups: Record<string, any[]> = {};
          for (const f of files) {
            const hash = await getFileHash(f.path);
            f.hash = hash;
            if (!hashGroups[hash]) hashGroups[hash] = [];
            hashGroups[hash].push(f);
          }
          
          for (const hash in hashGroups) {
            if (hashGroups[hash].length > 1) {
              duplicateGroups.push({
                hash,
                files: hashGroups[hash]
              });
            }
          }
        }
      }

      res.json({ duplicateGroups });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: Scan for sync
  app.post("/api/scan-sync", async (req, res) => {
    try {
      const { sourceDir, targetDir } = req.body;
      if (!fs.existsSync(sourceDir) || !fs.existsSync(targetDir)) {
        return res.status(400).json({ error: "One or both directories do not exist" });
      }

      const sourceFiles = await walkDir(sourceDir);
      const targetFiles = await walkDir(targetDir);

      const diffs = [];
      let totalSizeToSync = 0;

      // Create maps for quick lookup by relative path
      const sourceMap = new Map(sourceFiles.map(f => [path.relative(sourceDir, f.path), f]));
      const targetMap = new Map(targetFiles.map(f => [path.relative(targetDir, f.path), f]));

      // Check source against target
      for (const [relPath, sFile] of sourceMap.entries()) {
        const tFile = targetMap.get(relPath);
        if (!tFile) {
          diffs.push({ type: 'missing-in-b', fileA: sFile, relPath });
          totalSizeToSync += sFile.size;
        } else {
          // Compare hashes if files exist in both
          const sHash = await getFileHash(sFile.path);
          const tHash = await getFileHash(tFile.path);
          if (sHash !== tHash) {
            diffs.push({ type: 'different-version', fileA: sFile, fileB: tFile, relPath });
            totalSizeToSync += sFile.size;
          }
        }
      }

      // Check target against source
      for (const [relPath, tFile] of targetMap.entries()) {
        if (!sourceMap.has(relPath)) {
          diffs.push({ type: 'missing-in-a', fileB: tFile, relPath });
          totalSizeToSync += tFile.size;
        }
      }

      const missingInA = diffs.filter(d => d.type === 'missing-in-a').length;
      const missingInB = diffs.filter(d => d.type === 'missing-in-b').length;

      res.json({
        diffs,
        stats: {
          missingInA,
          missingInB,
          totalSizeToSync,
          scratchDiskNeeded: totalSizeToSync * 1.1
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: Delete files
  app.post("/api/delete-files", async (req, res) => {
    try {
      const { filePaths } = req.body;
      for (const filePath of filePaths) {
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: Move to Trash
  app.post("/api/move-to-trash", async (req, res) => {
    try {
      const { filePaths } = req.body;
      for (const filePath of filePaths) {
        if (fs.existsSync(filePath)) {
          const fileName = path.basename(filePath);
          const trashDir = path.join(path.dirname(filePath), 'MintSync_Trash');
          if (!fs.existsSync(trashDir)) {
            await fs.promises.mkdir(trashDir, { recursive: true });
          }
          await fs.promises.rename(filePath, path.join(trashDir, fileName));
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: Execute Sync
  // API: List files in scratch disk
  app.get("/api/list-scratch", async (req, res) => {
    try {
      const { scratchDiskPath } = req.query;
      if (!scratchDiskPath || typeof scratchDiskPath !== 'string') {
        return res.status(400).json({ error: "Scratch disk path is required" });
      }

      if (!fs.existsSync(scratchDiskPath)) {
        return res.json([]);
      }

      const files: any[] = [];
      const scan = async (dir: string, base: string) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relPath = path.join(base, entry.name);
          if (entry.isDirectory()) {
            await scan(fullPath, relPath);
          } else {
            const stats = await fs.promises.stat(fullPath);
            files.push({
              name: entry.name,
              path: fullPath,
              relPath,
              size: stats.size,
              lastModified: stats.mtime.getTime()
            });
          }
        }
      };

      await scan(scratchDiskPath, '');
      res.json(files);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: Delete from scratch
  app.post("/api/delete-from-scratch", async (req, res) => {
    try {
      const { paths } = req.body;
      for (const p of paths) {
        if (fs.existsSync(p)) {
          await fs.promises.unlink(p);
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/execute-sync", async (req, res) => {
    try {
      const { sourceDir, targetDir, operations, scratchDiskPath } = req.body;
      console.log(`Executing sync: ${operations.length} operations`);
      
      for (const op of operations) {
        let src = '';
        let dest = '';
        let isMove = false;

        if (op.action === 'mirror-to-b') {
          src = op.sourcePath;
          dest = path.join(targetDir, op.relPath);
        } else if (op.action === 'mirror-to-a') {
          src = op.sourcePath;
          dest = path.join(sourceDir, op.relPath);
        } else if (op.action === 'move-to-scratch') {
          src = op.sourcePath;
          // Use relPath to preserve structure and avoid collisions in scratch disk
          dest = path.join(scratchDiskPath, op.relPath);
          isMove = true;
        }

        if (src && dest) {
          const destDir = path.dirname(dest);
          if (!fs.existsSync(destDir)) {
            await fs.promises.mkdir(destDir, { recursive: true });
          }
          
          if (isMove) {
            await moveFile(src, dest);
          } else {
            await fs.promises.copyFile(src, dest);
          }
        }
      }
      res.json({ success: true });
    } catch (error: any) {
      console.error("Sync execution error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API: List saved sessions
  app.get("/api/list-sessions", async (req, res) => {
    try {
      const sessionsDir = path.join(os.tmpdir(), 'mintsync_sessions');
      if (!fs.existsSync(sessionsDir)) {
        return res.json([]);
      }
      const files = await fs.promises.readdir(sessionsDir);
      const sessions = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.promises.readFile(path.join(sessionsDir, file), 'utf-8');
          const session = JSON.parse(content);
          sessions.push({
            id: file,
            name: session.name,
            timestamp: session.timestamp,
            path: path.join(sessionsDir, file)
          });
        }
      }
      res.json(sessions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: Save session
  app.post("/api/save-session", async (req, res) => {
    try {
      const { name, state } = req.body;
      const sessionsDir = path.join(os.tmpdir(), 'mintsync_sessions');
      if (!fs.existsSync(sessionsDir)) {
        await fs.promises.mkdir(sessionsDir, { recursive: true });
      }
      const fileName = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.json`;
      const sessionPath = path.join(sessionsDir, fileName);
      const sessionData = {
        name,
        timestamp: new Date().toISOString(),
        state
      };
      await fs.promises.writeFile(sessionPath, JSON.stringify(sessionData, null, 2));
      res.json({ success: true, fileName });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: Delete session
  app.delete("/api/delete-session", async (req, res) => {
    try {
      const { fileName } = req.query;
      if (!fileName) {
        return res.status(400).json({ error: "fileName is required" });
      }
      const sessionsDir = path.join(os.tmpdir(), 'mintsync_sessions');
      const sessionPath = path.join(sessionsDir, fileName as string);
      
      if (fs.existsSync(sessionPath)) {
        await fs.promises.unlink(sessionPath);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Session not found" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API: Load session
  app.get("/api/load-session", async (req, res) => {
    try {
      const { fileName } = req.query;
      const sessionsDir = path.join(os.tmpdir(), 'mintsync_sessions');
      const sessionPath = path.join(sessionsDir, fileName as string);
      if (!fs.existsSync(sessionPath)) {
        return res.status(404).json({ error: "Session not found" });
      }
      const content = await fs.promises.readFile(sessionPath, 'utf-8');
      const session = JSON.parse(content);
      
      // Check if drives/paths in session exist
      const missingPaths = [];
      const pathsToCheck = [];
      if (session.state.sourceDir) pathsToCheck.push(session.state.sourceDir);
      if (session.state.targetDir) pathsToCheck.push(session.state.targetDir);
      if (session.state.scanDir) pathsToCheck.push(session.state.scanDir);
      if (session.state.scratchDiskPath) pathsToCheck.push(session.state.scratchDiskPath);
      
      for (const p of pathsToCheck) {
        if (!fs.existsSync(p)) {
          missingPaths.push(p);
        }
      }

      res.json({ ...session, missingPaths });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
