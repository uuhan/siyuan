import {IPlatformAPI} from "./types";

/**
 * Browser/no-op implementation.
 * Used when running in a plain browser without Electron or Tauri.
 */
export const browserPlatform: IPlatformAPI = {
    minimize() {},
    maximize() {},
    restore() {},
    show() {},
    hide() {},
    focus() {},
    destroy() {},
    setAlwaysOnTop() {},
    async isFullScreen() { return false; },
    async isMaximized() { return false; },
    async isAlwaysOnTop() { return false; },
    closeButtonBehavior() {},

    setZoomFactor() {},
    clearCache() {},

    undo() { document.execCommand("undo"); },
    redo() { document.execCommand("redo"); },

    showItemInFolder() {},
    openPath() {},
    openExternal(url: string) { window.open(url); },
    openDevTools() {},

    async showOpenDialog() { return {filePaths: []}; },
    async showSaveDialog() { return {filePath: ""}; },

    async clipboardRead() { return ""; },

    showNotification(title: string, body: string) {
        if ("Notification" in window && Notification.permission === "granted") {
            new Notification(title, {body});
        }
    },

    setAutoLaunch() {},
    setSpellCheckerLanguages() {},
    async getSpellCheckerLanguages() { return []; },
    async getMicrophoneAccess() { return "unknown"; },
    async askMicrophoneAccess() { return false; },
    async setProxy() {},

    registerGlobalShortcuts() {},
    unregisterGlobalShortcut() {},

    configTray() {},
    writeLog(msg: string) { console.log("[SiYuan]", msg); },
    setTrafficLightPosition() {},

    quit() {},
    async init() {},
    readyToShow() {},
    openWorkspace() {},

    onWindowEvent() {},
    onOpenUrl() {},
    onOpenFile() {},
    onSaveClose() {},
    onSendWindows() {},
    onGlobalHotkey() {},
    onExportPdf() {},

    sendToAllWindows() {},
    showContextMenu() {},
    openNewWindow() {},
    async openFileInWindow() {},

    async getContentsId() { return 0; },
};
