import {IPlatformAPI} from "./types";

// Lazy-loaded Tauri APIs to avoid import errors on non-Tauri builds
const getTauriWindow = () => import("@tauri-apps/api/window");
const getTauriCore = () => import("@tauri-apps/api/core");
const getTauriEvent = () => import("@tauri-apps/api/event");
const getTauriDialog = () => import("@tauri-apps/plugin-dialog");
const getTauriClipboard = () => import("@tauri-apps/plugin-clipboard-manager");

const tauriDialogPropertiesToOptions = (options: any = {}) => {
    const properties: string[] = Array.isArray(options?.properties) ? options.properties : [];
    const directory = properties.includes("openDirectory");
    const multiple = properties.includes("multiSelections");
    const title = options?.title;
    const defaultPath = options?.defaultPath;
    const filters = Array.isArray(options?.filters) ? options.filters : undefined;
    return {directory, multiple, title, defaultPath, filters};
};

export const tauriPlatform: IPlatformAPI = {
    async minimize() {
        const {getCurrentWindow} = await getTauriWindow();
        await getCurrentWindow().minimize();
    },
    async maximize() {
        const {getCurrentWindow} = await getTauriWindow();
        await getCurrentWindow().maximize();
    },
    async restore() {
        const {getCurrentWindow} = await getTauriWindow();
        const win = getCurrentWindow();
        if (await win.isFullscreen()) {
            await win.setFullscreen(false);
        } else {
            await win.unmaximize();
        }
    },
    async show() {
        const {getCurrentWindow} = await getTauriWindow();
        await getCurrentWindow().show();
    },
    async hide() {
        const {getCurrentWindow} = await getTauriWindow();
        await getCurrentWindow().hide();
    },
    async focus() {
        const {getCurrentWindow} = await getTauriWindow();
        await getCurrentWindow().setFocus();
    },
    destroy() {
        // In single-window Tauri, destroy = close
        getTauriWindow().then(({getCurrentWindow}) => getCurrentWindow().close());
    },
    async setAlwaysOnTop(value: boolean) {
        const {getCurrentWindow} = await getTauriWindow();
        await getCurrentWindow().setAlwaysOnTop(value);
    },
    async isFullScreen() {
        const {getCurrentWindow} = await getTauriWindow();
        return await getCurrentWindow().isFullscreen();
    },
    async isMaximized() {
        const {getCurrentWindow} = await getTauriWindow();
        return await getCurrentWindow().isMaximized();
    },
    async isAlwaysOnTop() {
        const {getCurrentWindow} = await getTauriWindow();
        return await getCurrentWindow().isAlwaysOnTop();
    },
    closeButtonBehavior() {
        // Tauri: hide window (same as Electron closeButtonBehavior)
        getTauriWindow().then(({getCurrentWindow}) => getCurrentWindow().hide());
    },

    async setZoomFactor(factor: number) {
        const {getCurrentWebviewWindow} = await import("@tauri-apps/api/webviewWindow");
        await getCurrentWebviewWindow().setZoom(factor);
    },
    clearCache() {
        // No direct equivalent in Tauri, no-op for now
    },

    undo() {
        document.execCommand("undo");
    },
    redo() {
        document.execCommand("redo");
    },

    async showItemInFolder(path: string) {
        const {invoke} = await getTauriCore();
        await invoke("plugin:shell|open", {path, with: "xdg-open"}).catch(() => {
            // Fallback: use custom command
        });
    },
    async openPath(path: string) {
        const {invoke} = await getTauriCore();
        await invoke("plugin:shell|open", {path});
    },
    async openExternal(url: string) {
        const {invoke} = await getTauriCore();
        await invoke("plugin:shell|open", {path: url});
    },
    openDevTools() {
        // Tauri v2: toggle devtools
        getTauriCore().then(({invoke}) => {
            invoke("plugin:webview|internal_toggle_devtools");
        });
    },

    async showOpenDialog(options: any) {
        const {open} = await getTauriDialog();
        const result = await open(tauriDialogPropertiesToOptions(options));
        if (!result) {
            return {canceled: true, filePaths: []};
        }
        if (Array.isArray(result)) {
            return {canceled: result.length === 0, filePaths: result};
        }
        return {canceled: false, filePaths: [result]};
    },
    async showSaveDialog(options: any) {
        const {save} = await getTauriDialog();
        const filePath = await save({
            title: options?.title,
            defaultPath: options?.defaultPath,
            filters: options?.filters,
        });
        return {canceled: !filePath, filePath: filePath || ""};
    },

    async clipboardRead(format: string) {
        const {readText} = await getTauriClipboard();
        // Tauri does not expose platform-specific clipboard format reads like NSFilenamesPboardType.
        if (format && format !== "text/plain") {
            return "";
        }
        return await readText();
    },

    showNotification(title: string, body: string, _timeoutType?: string) {
        // Use Web Notification API as fallback
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, {body});
        } else if ("Notification" in window) {
            Notification.requestPermission().then(p => {
                if (p === "granted") {
                    new Notification(title, {body});
                }
            });
        }
    },

    setAutoLaunch(openAtLogin: boolean, _openAsHidden: boolean) {
        // Persist desired behavior; backend/system setting remains the source of truth.
        localStorage.setItem("siyuan-tauri-auto-launch", openAtLogin ? "1" : "0");
    },
    setSpellCheckerLanguages(_languages: string[]) {
        // No equivalent in Tauri WebView
    },
    async getSpellCheckerLanguages() {
        return [];
    },
    async getMicrophoneAccess() {
        return "unknown";
    },
    async askMicrophoneAccess() {
        return false;
    },
    async setProxy(_proxyURL: string) {
        // No equivalent in Tauri
    },

    registerGlobalShortcuts(_hotkeys: string[], _languages: any) {
        // Tauri global shortcut bridge is not wired in backend yet; keep explicit no-op.
    },
    unregisterGlobalShortcut(_accelerator: string) {
        // Tauri global shortcut bridge is not wired in backend yet; keep explicit no-op.
    },

    configTray(_languages: any) {
        // Tray is managed by Rust side on startup.
    },

    writeLog(msg: string) {
        console.log("[SiYuan]", msg);
    },

    setTrafficLightPosition(_zoom: number, _position: { x: number; y: number }) {
        // macOS only, handled by Tauri window config
    },

    async quit(_port: string) {
        const {exit} = await import("@tauri-apps/plugin-process");
        await exit(0);
    },
    async init(_data: { languages: any; workspaceDir: string; port: string }) {
        // Tauri: kernel is already booted by Rust side
    },
    readyToShow() {
        getTauriWindow().then(({getCurrentWindow}) => getCurrentWindow().show());
    },
    openWorkspace(workspace: string) {
        if (workspace) {
            this.openPath(workspace);
        }
    },

    async onWindowEvent(callback: (event: string) => void) {
        const {getCurrentWindow} = await getTauriWindow();
        const win = getCurrentWindow();
        win.onFocusChanged(({payload: focused}) => {
            callback(focused ? "focus" : "blur");
        });
        win.onResized(() => {
            // Tauri doesn't distinguish fullscreen/maximize events as cleanly
            win.isFullscreen().then(fs => {
                if (fs) {
                    callback("enter-full-screen");
                }
            });
            win.isMaximized().then(max => {
                callback(max ? "maximize" : "unmaximize");
            });
        });
    },
    async onOpenUrl(callback: (url: string) => void) {
        const {listen} = await getTauriEvent();
        listen("siyuan-open-url", (event: any) => {
            callback(event.payload as string);
        });
    },
    async onOpenFile(callback: (data: any) => void) {
        const {listen} = await getTauriEvent();
        listen("siyuan-open-file", (event: any) => {
            callback(event.payload);
        });
    },
    async onSaveClose(callback: (close: boolean) => void) {
        const {getCurrentWindow} = await getTauriWindow();
        getCurrentWindow().onCloseRequested(async (event) => {
            event.preventDefault();
            callback(true);
        });
    },
    async onSendWindows(callback: (data: any) => void) {
        const {listen} = await getTauriEvent();
        listen("siyuan-send-windows", (event: any) => {
            callback(event.payload);
        });
    },
    async onGlobalHotkey(callback: (data: any) => void) {
        const {listen} = await getTauriEvent();
        listen("siyuan-hotkey", (event: any) => {
            callback(event.payload);
        });
    },
    async onExportPdf(_callback: (data: any) => void) {
        // PDF export callback is Electron-only. Tauri flow uses kernel-side export fallback.
    },

    sendToAllWindows(_data: any) {
        // Single window MVP: no-op
    },
    showContextMenu(_langs: any) {
        // Native context menu not yet wired for Tauri; browser menu remains available.
    },
    async openNewWindow(data: any) {
        const url = data?.url;
        if (url) {
            const {WebviewWindow} = await import("@tauri-apps/api/webviewWindow");
            const label = `window-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            const windowInstance = new WebviewWindow(label, {
                url,
                title: "SiYuan",
                width: data?.width || 1200,
                height: data?.height || 800,
                x: data?.position?.x,
                y: data?.position?.y,
                alwaysOnTop: !!data?.alwaysOnTop,
                decorations: false,
                transparent: true,
            });
            windowInstance.once("tauri://error", () => {
                this.openExternal(url);
            });
        }
    },
    async openFileInWindow(_data: any) {
        // Single window MVP: no-op
    },

    async getContentsId() {
        return 0;
    },
};
