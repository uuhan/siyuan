import {App} from "../index";
/// #if !BROWSER
import {platform} from "../platform";
/// #endif

export const closeWindow = async (app: App) => {
    for (let i = 0; i < app.plugins.length; i++) {
        try {
            await app.plugins[i].onunload();
        } catch (e) {
            console.error(e);
        }
    }
    /// #if !BROWSER
    platform.destroy();
    /// #endif
};
