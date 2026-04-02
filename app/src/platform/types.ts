/**
 * Platform abstraction layer for SiYuan.
 * Implementations: electron.ts, tauri.ts, browser.ts
 */
export interface IPlatformAPI {
    // Window management
    minimize(): void;
    maximize(): void;
    restore(): void;
    show(): void;
    hide(): void;
    focus(): void;
    destroy(webContentsId?: number): void;
    setAlwaysOnTop(value: boolean): void;
    isFullScreen(): Promise<boolean>;
    isMaximized(): Promise<boolean>;
    isAlwaysOnTop(): Promise<boolean>;
    closeButtonBehavior(): void;

    // Zoom & cache
    setZoomFactor(factor: number): void;
    clearCache(): void;

    // Undo/Redo (webContents level)
    undo(): void;
    redo(): void;

    // Shell operations
    showItemInFolder(path: string): void;
    openPath(path: string): void;
    openExternal(url: string): void;
    openDevTools(): void;

    // Dialogs
    showOpenDialog(options: any): Promise<any>;
    showSaveDialog(options: any): Promise<any>;

    // Clipboard
    clipboardRead(format: string): Promise<string>;

    // Notifications
    showNotification(title: string, body: string, timeoutType?: string): void;

    // System
    setAutoLaunch(openAtLogin: boolean, openAsHidden: boolean): void;
    setSpellCheckerLanguages(languages: string[]): void;
    getSpellCheckerLanguages(): Promise<string[]>;
    getMicrophoneAccess(): Promise<string>;
    askMicrophoneAccess(): Promise<boolean>;
    setProxy(proxyURL: string): Promise<void>;

    // Global shortcuts
    registerGlobalShortcuts(hotkeys: string[], languages: any): void;
    unregisterGlobalShortcut(accelerator: string): void;

    // Tray
    configTray(languages: any): void;

    // Logging
    writeLog(msg: string): void;

    // macOS traffic light
    setTrafficLightPosition(zoom: number, position: { x: number; y: number }): void;

    // Lifecycle
    quit(port: string): void;
    init(data: { languages: any; workspaceDir: string; port: string }): Promise<void>;
    readyToShow(): void;
    openWorkspace(workspace: string): void;

    // Event listeners
    onWindowEvent(callback: (event: string) => void): void;
    onOpenUrl(callback: (url: string) => void): void;
    onOpenFile(callback: (data: any) => void): void;
    onSaveClose(callback: (close: boolean) => void): void;
    onSendWindows(callback: (data: any) => void): void;
    onGlobalHotkey(callback: (data: any) => void): void;
    onExportPdf(callback: (data: any) => void): void;

    // Broadcasting
    sendToAllWindows(data: any): void;
    showContextMenu(langs: any): void;
    openNewWindow(data: any): void;
    openFileInWindow(data: any): Promise<void>;

    // Electron-specific IDs (no-op on other platforms)
    getContentsId(): Promise<number>;
}
