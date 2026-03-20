# MintSync & Dupe

A modern, high-performance file duplication finder and drive synchronization tool designed for offline use. MintSync & Dupe helps you manage large file collections across multiple drives, find exact duplicates using SHA-256 hashing, and synchronize folders with a staging "scratch disk" workflow.

**No internet connection is required.** All processing happens locally on your machine.

---

## 🚀 Quick Start (All Operating Systems)

1.  **Install Node.js**: Download and install Node.js (v18 or newer) from [nodejs.org](https://nodejs.org/).
2.  **Download MintSync**: Extract the application folder to your preferred location.
3.  **Install Dependencies**: Open a terminal in the application folder and run:
    ```bash
    npm install
    ```
4.  **Run the App**:
    ```bash
    npm start
    ```
5.  **Open in Browser**: Navigate to [http://localhost:3000](http://localhost:3000) if it doesn't open automatically.

---

## 🐧 Linux (Linux Mint 22.3, MX Linux 25, etc.)

MintSync is optimized for Linux environments and includes a desktop shortcut.

### Option 1: Desktop Shortcut (Easiest)
1.  Right-click `MintSync.desktop` and select **Allow Launching** (or make it executable in properties).
2.  Double-click the icon to launch the server and browser automatically.

### Option 2: Terminal Script
1.  Open a terminal in the folder.
2.  Run `./run.sh`. This script will install dependencies on the first run and launch the app.

---

## 🪟 Microsoft Windows 11

Windows users can run the app via PowerShell or Command Prompt.

1.  Open **PowerShell** or **CMD** in the application folder.
2.  Run the following commands:
    ```powershell
    npm install
    npm start
    ```
3.  The application will be available at `http://localhost:3000`.
4.  *Tip: You can create a shortcut to `npm start` on your desktop for easier access.*

---

## 🍎 macOS

1.  Open **Terminal**.
2.  Navigate to the MintSync folder (e.g., `cd ~/Downloads/MintSync`).
3.  Run:
    ```bash
    npm install
    npm start
    ```
4.  Open Safari or Chrome and go to `http://localhost:3000`.

---

## 🛠️ Key Features

-   **Duplicate Finder**: Scans directories for identical files using SHA-256 content hashing.
-   **Drive Sync**: Compare two drives (A and B) and synchronize missing files in either direction.
-   **Scratch Disk Management**: Stage files in a temporary "scratch" location before final synchronization—perfect for organizing large media collections.
-   **Session Management**: Save your scan results and sync queues to continue your work later.
-   **Cross-Platform Picker**: A built-in folder picker that understands Windows drive letters (`C:\`, `D:\`) and Linux mount points (`/media`, `/mnt`).

---

## 🔒 Privacy & Offline Usage

MintSync & Dupe is built with privacy in mind:
-   **100% Offline**: No data is ever sent to the cloud.
-   **Local Processing**: File hashing and comparisons happen entirely on your CPU.
-   **No Tracking**: No analytics or telemetry.

---

## 📂 Troubleshooting

-   **Port 3000 in use**: If the app fails to start, ensure no other service is using port 3000.
-   **Permissions**: Ensure the user running the app has read/write permissions for the drives you wish to scan.
-   **Node.js Version**: If you see syntax errors, ensure you are using Node.js v18 or higher (`node -v`).

---

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.
