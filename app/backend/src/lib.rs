mod commands;
mod kernel;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .manage(kernel::KernelState::new())
        .invoke_handler(tauri::generate_handler![
            commands::get_kernel_port,
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                match kernel::boot_kernel(&app_handle).await {
                    Ok(port) => {
                        let url = kernel::frontend_url(port);
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.navigate(url.parse().unwrap());
                            let _ = window.show();
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to boot kernel: {}", e);
                        std::process::exit(1);
                    }
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                let app = window.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(state) = app.try_state::<kernel::KernelState>() {
                        let _ = kernel::shutdown_kernel(state.port()).await;
                    }
                });
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running SiYuan");
}
