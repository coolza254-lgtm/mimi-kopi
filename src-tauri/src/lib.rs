mod audio;
mod midi_io;

use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use mimi_core::audio::{AudioCommand, Channel};
use mimi_core::synth::load_sound_font;
use serde::Serialize;
use tauri::{Manager, State};

use audio::{AudioEngine, AudioStatus};
use midi_io::{MidiService, MidiStatus};

struct AppState {
    audio: Arc<AudioEngine>,
    midi: Arc<MidiService>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    version: &'static str,
    phase: u8,
    /// Stays false until the Badger C-918 checklist passes on real hardware.
    hardware_verified: bool,
}

#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION"),
        phase: 1,
        hardware_verified: false,
    }
}

#[tauri::command]
fn midi_list_inputs() -> Result<Vec<String>, String> {
    MidiService::list_inputs()
}

#[tauri::command]
fn midi_connect(state: State<'_, AppState>, name: String) -> MidiStatus {
    state.midi.connect(&name)
}

#[tauri::command]
fn midi_disconnect(state: State<'_, AppState>) -> MidiStatus {
    state.midi.disconnect()
}

#[tauri::command]
fn midi_status(state: State<'_, AppState>) -> MidiStatus {
    state.midi.status()
}

/// Feeds raw MIDI bytes from the on-screen keyboard through the same pipeline
/// as a real device, marked as simulated.
#[tauri::command]
fn midi_simulate(state: State<'_, AppState>, bytes: Vec<u8>) {
    state.midi.simulate(&bytes);
}

#[tauri::command]
fn midi_release_all(state: State<'_, AppState>) {
    state.midi.release_all();
}

#[tauri::command]
fn audio_list_outputs() -> Vec<String> {
    audio::output_device_names()
}

#[tauri::command]
async fn audio_open(
    state: State<'_, AppState>,
    device: Option<String>,
) -> Result<AudioStatus, String> {
    Ok(state.audio.open(device))
}

#[tauri::command]
fn audio_status(state: State<'_, AppState>) -> AudioStatus {
    state.audio.status()
}

#[tauri::command]
fn audio_set_gain(state: State<'_, AppState>, channel: String, value: f32) -> Result<(), String> {
    let channel = Channel::parse(&channel).ok_or_else(|| format!("unknown channel: {channel}"))?;
    state.audio.gains.set(channel, value);
    Ok(())
}

/// Loads a user-chosen `.sf2`. Nothing is bundled: SoundFont licences vary
/// (spec §2.2), so the user picks one they are allowed to use.
#[tauri::command]
async fn audio_load_soundfont(
    state: State<'_, AppState>,
    path: String,
) -> Result<AudioStatus, String> {
    let file = File::open(&path).map_err(|e| e.to_string())?;
    let font = load_sound_font(&mut BufReader::new(file))?;
    let name = Path::new(&path)
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or(path);
    Ok(state.audio.set_sound_font(font, name))
}

/// Plays a short C major chord on the current output.
#[tauri::command]
fn audio_test_sound(state: State<'_, AppState>) {
    const CHORD: [u8; 3] = [60, 64, 67];
    for pitch in CHORD {
        state.audio.send(AudioCommand::NoteOn {
            pitch,
            velocity: 90,
        });
    }
    let audio = state.audio.clone();
    thread::spawn(move || {
        thread::sleep(Duration::from_millis(800));
        for pitch in CHORD {
            audio.send(AudioCommand::NoteOff { pitch });
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let audio = Arc::new(AudioEngine::start());
            // A missing or busy device is reported in the status, not fatal.
            audio.open(None);
            let midi = MidiService::new(app.handle().clone(), audio.clone());
            app.manage(AppState { audio, midi });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_info,
            midi_list_inputs,
            midi_connect,
            midi_disconnect,
            midi_status,
            midi_simulate,
            midi_release_all,
            audio_list_outputs,
            audio_open,
            audio_status,
            audio_set_gain,
            audio_load_soundfont,
            audio_test_sound,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Mimi Kopi");
}
