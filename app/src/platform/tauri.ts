import {IPlatformAPI} from "./types";

// Lazy-loaded Tauri APIs to avoid import errors on non-Tauri builds
const getTauriWindow = () => import("@tauri-apps/api/window");
const getTauriCore = () => import("@tauri-apps/api/core");
const getTauriEvent = () => import("@tauri-apps/api/event");

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
        // TODO Phase 5: use @tauri-apps/plugin-dialog
        return {filePaths: []};
    },
    async showSaveDialog(options: any) {
        // TODO Phase 5: use @tauri-apps/plugin-dialog
        return {filePath: ""};
    },

    async clipboardRead(_format: string) {
        // TODO Phase 5: use @tauri-apps/plugin-clipboard-manager
        return "";
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

    setAutoLaunch(_openAtLogin: boolean, _openAsHidden: boolean) {
        // TODO Phase 6: use @tauri-apps/plugin-autostart
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
        // TODO Phase 6: use @tauri-apps/plugin-global-shortcut
    },
    unregisterGlobalShortcut(_accelerator: string) {
        // TODO Phase 6
    },

    configTray(_languages: any) {
        // TODO Phase 6: Rust-side tray management
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
    openWorkspace(_workspace: string) {
        // TODO: single workspace for MVP
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
        // PDF export not supported in Tauri MVP
    },

    sendToAllWindows(_data: any) {
        // Single window MVP: no-op
    },
    showContextMenu(_langs: any) {
        // TODO: implement with Tauri menu API
    },
    openNewWindow(_data: any) {
        // Single window MVP: no-op
    },
    async openFileInWindow(_data: any) {
        // Single window MVP: no-op
    },

    async getContentsId() {
        return 0;
    },
};
