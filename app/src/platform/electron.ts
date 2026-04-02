import {ipcRenderer, shell, webFrame} from "electron";
import {Constants} from "../constants";
import {IPlatformAPI} from "./types";

export const electronPlatform: IPlatformAPI = {
    minimize() {
        ipcRenderer.send(Constants.SIYUAN_CMD, "minimize");
    },
    maximize() {
        ipcRenderer.send(Constants.SIYUAN_CMD, "maximize");
    },
    restore() {
        ipcRenderer.send(Constants.SIYUAN_CMD, "restore");
    },
    show() {
        ipcRenderer.send(Constants.SIYUAN_CMD, "show");
    },
    hide() {
        ipcRenderer.send(Constants.SIYUAN_CMD, "hide");
    },
    focus() {
        ipcRenderer.send(Constants.SIYUAN_CMD, "focus");
    },
    destroy(webContentsId?: number) {
        if (webContentsId !== undefined) {
            ipcRenderer.send(Constants.SIYUAN_CMD, {cmd: "destroy", webContentsId});
        } else {
            ipcRenderer.send(Constants.SIYUAN_CMD, "destroy");
        }
    },
    setAlwaysOnTop(value: boolean) {
        ipcRenderer.send(Constants.SIYUAN_CMD, value ? "setAlwaysOnTopTrue" : "setAlwaysOnTopFalse");
    },
    async isFullScreen() {
        return await ipcRenderer.invoke(Constants.SIYUAN_GET, {cmd: "isFullScreen"});
    },
    async isMaximized() {
        return await ipcRenderer.invoke(Constants.SIYUAN_GET, {cmd: "isMaximized"});
    },
    async isAlwaysOnTop() {
        return await ipcRenderer.invoke(Constants.SIYUAN_GET, {cmd: "isAlwaysOnTop"});
    },
    closeButtonBehavior() {
        ipcRenderer.send(Constants.SIYUAN_CMD, "closeButtonBehavior");
    },

    setZoomFactor(factor: number) {
        webFrame.setZoomFactor(factor);
    },
    clearCache() {
        webFrame.clearCache();
    },

    undo() {
        ipcRenderer.send(Constants.SIYUAN_CMD, "undo");
    },
    redo() {
        ipcRenderer.send(Constants.SIYUAN_CMD, "redo");
    },

    showItemInFolder(path: string) {
        ipcRenderer.send(Constants.SIYUAN_CMD, {cmd: "showItemInFolder", filePath: path});
    },
    openPath(path: string) {
        ipcRenderer.send(Constants.SIYUAN_CMD, {cmd: "openPath", filePath: path});
    },
    openExternal(url: string) {
        shell.openExternal(url);
    },
    openDevTools() {
        ipcRenderer.send(Constants.SIYUAN_CMD, "openDevTools");
    },

    async showOpenDialog(options: any) {
        return await ipcRenderer.invoke(Constants.SIYUAN_GET, {cmd: "showOpenDialog", ...options});
    },
    async showSaveDialog(options: any) {
        return await ipcRenderer.invoke(Constants.SIYUAN_GET, {cmd: "showSaveDialog", ...options});
    },

    async clipboardRead(format: string) {
        return await ipcRenderer.invoke(Constants.SIYUAN_GET, {cmd: "clipboardRead", format});
    },

    showNotification(title: string, body: string, timeoutType?: string) {
        ipcRenderer.send(Constants.SIYUAN_CMD, {
            cmd: "notification",
            title,
            body,
            timeoutType: timeoutType || "default"
        });
    },

    setAutoLaunch(openAtLogin: boolean, openAsHidden: boolean) {
        ipcRenderer.send(Constants.SIYUAN_AUTO_LAUNCH, {openAtLogin, openAsHidden});
    },
    setSpellCheckerLanguages(languages: string[]) {
        ipcRenderer.send(Constants.SIYUAN_CMD, {cmd: "setSpellCheckerLanguages", languages});
    },
    async getSpellCheckerLanguages() {
        return await ipcRenderer.invoke(Constants.SIYUAN_GET, {cmd: "availableSpellCheckerLanguages"});
    },
    async getMicrophoneAccess() {
        return await ipcRenderer.invoke(Constants.SIYUAN_GET, {cmd: "getMicrophone"});
    },
    async askMicrophoneAccess() {
        return await ipcRenderer.invoke(Constants.SIYUAN_GET, {cmd: "askMicrophone"});
    },
    async setProxy(proxyURL: string) {
        await ipcRenderer.invoke(Constants.SIYUAN_GET, {cmd: "setProxy", proxyURL});
    },

    registerGlobalShortcuts(hotkeys: string[], languages: any) {
        ipcRenderer.send(Constants.SIYUAN_HOTKEY, {hotkeys, languages});
    },
    unregisterGlobalShortcut(accelerator: string) {
        ipcRenderer.send(Constants.SIYUAN_CMD, {cmd: "unregisterGlobalShortcut", accelerator});
    },

    configTray(languages: any) {
        ipcRenderer.send(Constants.SIYUAN_CONFIG_TRAY, {languages});
    },

    writeLog(msg: string) {
        ipcRenderer.send(Constants.SIYUAN_CMD, {cmd: "writeLog", msg});
    },

    setTrafficLightPosition(zoom: number, position: { x: number; y: number }) {
        ipcRenderer.send(Constants.SIYUAN_CMD, {cmd: "setTrafficLightPosition", zoom, position});
    },

    quit(port: string) {
        ipcRenderer.send(Constants.SIYUAN_QUIT, port);
    },
    async init(data: { languages: any; workspaceDir: string; port: string }) {
        await ipcRenderer.invoke(Constants.SIYUAN_INIT, data);
    },
    readyToShow() {
        ipcRenderer.send(Constants.SIYUAN_READY_TO_SHOW);
    },
    openWorkspace(workspace: string) {
        ipcRenderer.send(Constants.SIYUAN_OPEN_WORKSPACE, {workspace});
    },

    onWindowEvent(callback: (event: string) => void) {
        ipcRenderer.send(Constants.SIYUAN_EVENT);
        ipcRenderer.on(Constants.SIYUAN_EVENT, (_event, cmd) => {
            callback(cmd);
        });
    },
    onOpenUrl(callback: (url: string) => void) {
        ipcRenderer.on(Constants.SIYUAN_OPEN_URL, (_event, url) => {
            callback(url);
        });
    },
    onOpenFile(callback: (data: any) => void) {
        ipcRenderer.on(Constants.SIYUAN_OPEN_FILE, (_event, data) => {
            callback(data);
        });
    },
    onSaveClose(callback: (close: boolean) => void) {
        ipcRenderer.on(Constants.SIYUAN_SAVE_CLOSE, (_event, close) => {
            callback(close);
        });
    },
    onSendWindows(callback: (data: any) => void) {
        ipcRenderer.on(Constants.SIYUAN_SEND_WINDOWS, (_event, data) => {
            callback(data);
        });
    },
    onGlobalHotkey(callback: (data: any) => void) {
        ipcRenderer.on(Constants.SIYUAN_HOTKEY, (_event, data) => {
            callback(data);
        });
    },
    onExportPdf(callback: (data: any) => void) {
        ipcRenderer.on(Constants.SIYUAN_EXPORT_PDF, (_event, data) => {
            callback(data);
        });
    },

    sendToAllWindows(data: any) {
        ipcRenderer.send(Constants.SIYUAN_SEND_WINDOWS, data);
    },
    showContextMenu(langs: any) {
        ipcRenderer.sendSync(Constants.SIYUAN_CONTEXT_MENU, langs);
    },
    openNewWindow(data: any) {
        ipcRenderer.send(Constants.SIYUAN_OPEN_WINDOW, data);
    },
    async openFileInWindow(data: any) {
        await ipcRenderer.invoke(Constants.SIYUAN_GET, {cmd: "siyuan-open-file", ...data});
    },

    async getContentsId() {
        return await ipcRenderer.invoke(Constants.SIYUAN_GET, {cmd: "getContentsId"});
    },
};
