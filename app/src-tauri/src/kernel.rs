use std::net::TcpListener;
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;

/// Managed state holding the kernel port and child process handle.
pub struct KernelState {
    port: AtomicU16,
    _child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
}

impl KernelState {
    pub fn new() -> Self {
        Self {
            port: AtomicU16::new(0),
            _child: Mutex::new(None),
        }
    }

    pub fn port(&self) -> u16 {
        self.port.load(Ordering::Relaxed)
    }

    pub fn set_port(&self, port: u16) {
        self.port.store(port, Ordering::Relaxed);
    }

    pub fn set_child(&self, child: tauri_plugin_shell::process::CommandChild) {
        *self._child.lock().unwrap() = Some(child);
    }
}

/// Find an available TCP port on localhost.
fn find_available_port() -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind to find available port: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local addr: {}", e))?
        .port();
    drop(listener);
    Ok(port)
}

/// Resolve the working directory (where stage/, appearance/, etc. live).
fn resolve_working_dir(app: &AppHandle) -> String {
    let resource_dir = app
        .path()
        .resource_dir()
        .unwrap_or_else(|_| std::env::current_dir().unwrap());
    resource_dir.to_string_lossy().to_string()
}

/// Resolve the default workspace directory.
fn resolve_workspace_dir() -> String {
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    let workspace = home.join("SiYuan");
    workspace.to_string_lossy().to_string()
}

/// Boot the Go kernel sidecar and wait for it to be ready.
pub async fn boot_kernel(app: &AppHandle) -> Result<u16, String> {
    let port = find_available_port()?;
    let wd = resolve_working_dir(app);
    let workspace = resolve_workspace_dir();

    eprintln!(
        "Booting kernel: port={}, wd={}, workspace={}",
        port, wd, workspace
    );

    // Build sidecar command
    let shell = app.shell();
    let (mut rx, child) = shell
        .sidecar("binaries/SiYuan-Kernel")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .args([
            "--port",
            &port.to_string(),
            "--wd",
            &wd,
            "--workspace",
            &workspace,
        ])
        .spawn()
        .map_err(|e| format!("Failed to spawn kernel sidecar: {}", e))?;

    eprintln!("Kernel sidecar spawned, pid={}", child.pid());

    // Store child handle immediately
    if let Some(state) = app.try_state::<KernelState>() {
        state.set_child(child);
    }

    // Monitor sidecar output in background
    tauri::async_runtime::spawn(async move {
        use tauri_plugin_shell::process::CommandEvent;
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    eprintln!("[kernel stdout] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("[kernel stderr] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!("Kernel terminated: {:?}", payload);
                    break;
                }
                CommandEvent::Error(err) => {
                    eprintln!("Kernel error: {}", err);
                    break;
                }
                _ => {}
            }
        }
    });

    // Poll kernel until version endpoint responds (max 14 retries, 500ms apart)
    let client = reqwest::Client::new();
    let base_url = format!("http://127.0.0.1:{}", port);

    eprintln!("Waiting for kernel to be ready at {}", base_url);

    let mut count = 0;
    loop {
        match client
            .get(format!("{}/api/system/version", base_url))
            .timeout(Duration::from_secs(2))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                let data: serde_json::Value = resp
                    .json()
                    .await
                    .map_err(|e| format!("Failed to parse version response: {}", e))?;
                eprintln!("Kernel version: {}", data["data"]);
                break;
            }
            Ok(resp) => {
                eprintln!("Version check got status: {}", resp.status());
            }
            Err(e) => {
                eprintln!("Version check attempt {}: {}", count + 1, e);
            }
        }

        count += 1;
        if count > 14 {
            return Err("Kernel failed to start after 14 retries".to_string());
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    // Poll boot progress until 100%
    loop {
        match client
            .get(format!("{}/api/system/bootProgress", base_url))
            .timeout(Duration::from_secs(2))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                let data: serde_json::Value = resp
                    .json()
                    .await
                    .map_err(|e| format!("Failed to parse boot progress: {}", e))?;
                let progress = data["data"]["progress"].as_i64().unwrap_or(0);
                eprintln!("Boot progress: {}%", progress);
                if progress >= 100 {
                    break;
                }
            }
            Ok(_) => {}
            Err(e) => {
                return Err(format!("Failed to get boot progress: {}", e));
            }
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }

    // Update port in state
    if let Some(state) = app.try_state::<KernelState>() {
        state.set_port(port);
    }

    eprintln!("Kernel is ready on port {}", port);
    Ok(port)
}

/// Send graceful shutdown request to the kernel.
pub async fn shutdown_kernel(port: u16) -> Result<(), String> {
    if port == 0 {
        return Ok(());
    }
    eprintln!("Shutting down kernel on port {}", port);
    let client = reqwest::Client::new();
    let _ = client
        .post(format!("http://127.0.0.1:{}/api/system/exit", port))
        .timeout(Duration::from_secs(5))
        .send()
        .await;
    Ok(())
}
