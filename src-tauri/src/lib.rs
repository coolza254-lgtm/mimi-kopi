use mimi_core::midi::DeviceCapabilities;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CapabilityReport {
    note_on_off: &'static str,
    velocity: &'static str,
    sustain_cc64: &'static str,
    polyphony: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    version: &'static str,
    phase: u8,
    /// Stays false until the Badger C-918 checklist passes on real hardware.
    hardware_verified: bool,
    capabilities: CapabilityReport,
}

#[tauri::command]
fn app_info() -> AppInfo {
    let caps = DeviceCapabilities::default();
    AppInfo {
        version: env!("CARGO_PKG_VERSION"),
        phase: 0,
        hardware_verified: false,
        capabilities: CapabilityReport {
            note_on_off: caps.note_on_off.as_str(),
            velocity: caps.velocity.as_str(),
            sustain_cc64: caps.sustain_cc64.as_str(),
            polyphony: caps.polyphony.as_str(),
        },
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![app_info])
        .run(tauri::generate_context!())
        .expect("error while running Mimi Kopi");
}
