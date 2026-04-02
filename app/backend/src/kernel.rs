use std::net::TcpListener;
use std::sync::atomic::{AtomicU16, Ordering};
use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager};
use tauri_plugin_shell::ShellExt;

// ── Kernel protocol constants ──────────────────────────────────────────
// All knowledge of the Go kernel's HTTP API lives here. If the kernel
// changes its routes, only these constants need updating.

const SIDECAR_NAME: &str = "SiYuan-Kernel";
const KERNEL_HOST: &str = "127.0.0.1";

/// Kernel HTTP API endpoints.
mod api {
    pub const VERSION: &str = "/api/system/version";
    pub const BOOT_PROGRESS: &str = "/api/system/bootProgress";
    pub const EXIT: &str = "/api/system/exit";
}

/// Frontend entry point served by the kernel's static file server.
pub const FRONTEND_PATH: &str = "/stage/build/app/";

/// Kernel process exit codes (defined in kernel/util/exit_code.go).
mod exit_code {
    pub const DB_UNAVAILABLE: i32 = 20;
    pub const PORT_LISTEN_FAILED: i32 = 21;
    pub const WORKSPACE_LOCKED: i32 = 24;
    pub const WORKSPACE_INIT_FAILED: i32 = 25;
    pub const DATA_CORRUPTION_PREVENTION: i32 = 26;
}

/// Boot polling configuration.
const MAX_VERSION_RETRIES: u32 = 14;
const VERSION_RETRY_INTERVAL: Duration = Duration::from_millis(500);
const PROGRESS_POLL_INTERVAL: Duration = Duration::from_millis(100);
const HTTP_TIMEOUT: Duration = Duration::from_secs(2);

// ── State ──────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────

fn kernel_url(port: u16, path: &str) -> String {
    format!("http://{}:{}{}", KERNEL_HOST, port, path)
}

/// Build the URL the webview should navigate to after the kernel is ready.
pub fn frontend_url(port: u16) -> String {
    format!(
        "http://{}:{}{}?v={}",
        KERNEL_HOST,
        port,
        FRONTEND_PATH,
        env!("CARGO_PKG_VERSION")
    )
}

/// Find an available TCP port on localhost.
fn find_available_port() -> Result<u16, String> {
    let listener = TcpListener::bind(format!("{}:0", KERNEL_HOST))
        .map_err(|e| format!("Failed to bind to find available port: {}", e))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get local addr: {}", e))?
        .port();
    drop(listener);
    Ok(port)
}

/// Resolve the working directory (where stage/, appearance/, etc. live).
///
/// - Dev mode (`cfg(dev)`): the app/ directory (project root)
/// - Production: the Tauri resource directory (bundled alongside the binary)
fn resolve_working_dir(app: &AppHandle) -> String {
    if cfg!(dev) {
        // In dev mode, app/ is the parent of src-tauri/
        let manifest_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
        manifest_dir
            .parent()
            .unwrap_or(manifest_dir)
            .to_string_lossy()
            .to_string()
    } else {
        app.path()
            .resource_dir()
            .unwrap_or_else(|_| std::env::current_dir().unwrap())
            .to_string_lossy()
            .to_string()
    }
}

/// Resolve the default workspace directory (~/.SiYuan).
fn resolve_workspace_dir() -> String {
    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    home.join("SiYuan").to_string_lossy().to_string()
}

/// Map a kernel exit code to a human-readable error message.
fn exit_code_message(code: i32) -> &'static str {
    match code {
        exit_code::DB_UNAVAILABLE => "Database is unavailable",
        exit_code::PORT_LISTEN_FAILED => "Failed to listen on port",
        exit_code::WORKSPACE_LOCKED => "Workspace is locked by another instance",
        exit_code::WORKSPACE_INIT_FAILED => "Failed to initialize workspace directory",
        exit_code::DATA_CORRUPTION_PREVENTION => "Data corruption prevention: files occupied by third-party software",
        _ => "Kernel exited for unknown reasons",
    }
}

// ── Boot / Shutdown ────────────────────────────────────────────────────

/// Boot the Go kernel sidecar and wait for it to be ready.
pub async fn boot_kernel(app: &AppHandle) -> Result<u16, String> {
    let port = find_available_port()?;
    let wd = resolve_working_dir(app);
    let workspace = resolve_workspace_dir();

    eprintln!(
        "Booting kernel: port={}, wd={}, workspace={}",
        port, wd, workspace
    );

    // Spawn sidecar
    let shell = app.shell();
    let (mut rx, child) = shell
        .sidecar(SIDECAR_NAME)
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
                    let code = payload.code.unwrap_or(-1);
                    if code != 0 {
                        eprintln!(
                            "Kernel terminated with code {}: {}",
                            code,
                            exit_code_message(code)
                        );
                    } else {
                        eprintln!("Kernel terminated normally");
                    }
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

    // Poll kernel version endpoint
    let client = reqwest::Client::new();
    eprintln!("Waiting for kernel to be ready...");

    let mut count = 0;
    loop {
        match client
            .get(kernel_url(port, api::VERSION))
            .timeout(HTTP_TIMEOUT)
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
        if count > MAX_VERSION_RETRIES {
            return Err("Kernel failed to start after max retries".to_string());
        }
        tokio::time::sleep(VERSION_RETRY_INTERVAL).await;
    }

    // Poll boot progress until 100%
    loop {
        match client
            .get(kernel_url(port, api::BOOT_PROGRESS))
            .timeout(HTTP_TIMEOUT)
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
        tokio::time::sleep(PROGRESS_POLL_INTERVAL).await;
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
        .post(kernel_url(port, api::EXIT))
        .timeout(Duration::from_secs(5))
        .send()
        .await;
    Ok(())
}
