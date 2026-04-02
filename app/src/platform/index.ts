/// #if TAURI
export {tauriPlatform as platform} from "./tauri";
/// #elif BROWSER
export {browserPlatform as platform} from "./browser";
/// #else
export {tauriPlatform as platform} from "./tauri";
/// #endif
