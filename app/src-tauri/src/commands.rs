use crate::kernel::KernelState;

/// Returns the kernel HTTP port for frontend to connect.
#[tauri::command]
pub fn get_kernel_port(state: tauri::State<'_, KernelState>) -> u16 {
    state.port()
}
