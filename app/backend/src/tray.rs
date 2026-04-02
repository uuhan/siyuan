use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let devtools = MenuItemBuilder::with_id("devtools", "Open DevTools").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit SiYuan").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&devtools)
        .separator()
        .item(&quit)
        .build()?;

    let icon = Image::from_path(
        app.path()
            .resource_dir()
            .unwrap_or_default()
            .join("stage/icon.png"),
    )
    .unwrap_or_else(|_| Image::from_bytes(include_bytes!("../icons/icon.png")).unwrap());

    TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("SiYuan")
        .on_menu_event(|app, event| match event.id().as_ref() {
            "devtools" => {
                if let Some(window) = app.get_webview_window("main") {
                    if window.is_devtools_open() {
                        window.close_devtools();
                    } else {
                        window.open_devtools();
                    }
                }
            }
            "quit" => {
                let handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(state) =
                        handle.try_state::<crate::kernel::KernelState>()
                    {
                        let _ = crate::kernel::shutdown_kernel(state.port()).await;
                    }
                    handle.exit(0);
                });
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}
