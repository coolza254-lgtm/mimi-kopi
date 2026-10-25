//! MIDI input (spec §6.1): native ports through midir and the on-screen
//! simulator feed one pipeline that tracks keys, learns device capabilities,
//! plays the audio engine and emits events to the UI.
//!
//! Ports are addressed by name, since that is what a person recognises and
//! what survives unplugging. A watcher thread notices when the wanted port
//! disappears (releasing every held key so nothing sticks) and reconnects
//! when it comes back.

use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use midir::{Ignore, MidiInput, MidiInputConnection};
use mimi_core::audio::AudioCommand;
use mimi_core::capability::CapabilityObserver;
use mimi_core::midi::{DeviceCapabilities, KeyboardState, MidiMessage};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::audio::AudioEngine;

const CLIENT: &str = "Mimi Kopi";
const WATCH_INTERVAL: Duration = Duration::from_secs(1);
pub const SIMULATOR: &str = "simulator";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityReport {
    note_on_off: &'static str,
    velocity: &'static str,
    sustain_cc64: &'static str,
    polyphony: &'static str,
}

impl From<DeviceCapabilities> for CapabilityReport {
    fn from(caps: DeviceCapabilities) -> Self {
        Self {
            note_on_off: caps.note_on_off.as_str(),
            velocity: caps.velocity.as_str(),
            sustain_cc64: caps.sustain_cc64.as_str(),
            polyphony: caps.polyphony.as_str(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MidiStatus {
    /// The port that is open right now.
    connected: Option<String>,
    /// The port the user chose; the watcher reconnects to it.
    wanted: Option<String>,
    capabilities: CapabilityReport,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MidiEventPayload {
    /// Microseconds on this app's monotonic clock, taken when the event arrived.
    timestamp_us: u64,
    device: String,
    simulated: bool,
    kind: &'static str,
    channel: Option<u8>,
    pitch: Option<u8>,
    velocity: Option<u8>,
    control: Option<u8>,
    value: Option<u8>,
    raw: Vec<u8>,
}

/// Shared by the midir callback thread, the watcher and commands.
struct Pipeline {
    app: AppHandle,
    audio: Arc<AudioEngine>,
    keys: Mutex<KeyboardState>,
    observer: Mutex<CapabilityObserver>,
    start: Instant,
}

impl Pipeline {
    fn handle(&self, device: &str, simulated: bool, bytes: &[u8]) {
        let Some(message) = MidiMessage::parse(bytes) else {
            return;
        };
        let timestamp_us = u64::try_from(self.start.elapsed().as_micros()).unwrap_or(u64::MAX);
        self.keys.lock().unwrap().apply(&message);
        // Only real hardware can prove a capability (spec §2.2).
        if !simulated {
            self.observer.lock().unwrap().observe(&message);
        }
        if let Some(command) = AudioCommand::from_midi(&message) {
            self.audio.send(command);
        }
        let mut payload = MidiEventPayload {
            timestamp_us,
            device: device.to_string(),
            simulated,
            kind: "other",
            channel: None,
            pitch: None,
            velocity: None,
            control: None,
            value: None,
            raw: bytes.to_vec(),
        };
        match message {
            MidiMessage::NoteOn {
                channel,
                pitch,
                velocity,
            } => {
                payload.kind = "noteOn";
                (payload.channel, payload.pitch, payload.velocity) =
                    (Some(channel), Some(pitch), Some(velocity));
            }
            MidiMessage::NoteOff {
                channel,
                pitch,
                velocity,
            } => {
                payload.kind = "noteOff";
                (payload.channel, payload.pitch, payload.velocity) =
                    (Some(channel), Some(pitch), Some(velocity));
            }
            MidiMessage::ControlChange {
                channel,
                control,
                value,
            } => {
                payload.kind = "controlChange";
                (payload.channel, payload.control, payload.value) =
                    (Some(channel), Some(control), Some(value));
            }
            MidiMessage::Other => {}
        }
        let _ = self.app.emit("midi-event", payload);
    }

    /// Stops every sounding note and clears held keys (disconnect, focus loss).
    fn release_all(&self) {
        self.keys.lock().unwrap().reset();
        self.observer.lock().unwrap().release_keys();
        self.audio.send(AudioCommand::AllNotesOff);
        let _ = self.app.emit("midi-reset", ());
    }
}

#[derive(Default)]
struct Connection {
    handle: Option<MidiInputConnection<()>>,
    connected: Option<String>,
    wanted: Option<String>,
    error: Option<String>,
}

pub struct MidiService {
    pipeline: Arc<Pipeline>,
    connection: Mutex<Connection>,
}

impl MidiService {
    pub fn new(app: AppHandle, audio: Arc<AudioEngine>) -> Arc<Self> {
        let service = Arc::new(Self {
            pipeline: Arc::new(Pipeline {
                app,
                audio,
                keys: Mutex::new(KeyboardState::default()),
                observer: Mutex::new(CapabilityObserver::default()),
                start: Instant::now(),
            }),
            connection: Mutex::new(Connection::default()),
        });
        let watcher = Arc::downgrade(&service);
        thread::Builder::new()
            .name("midi-watch".into())
            .spawn(move || {
                while let Some(service) = watcher.upgrade() {
                    service.watch_once();
                    drop(service);
                    thread::sleep(WATCH_INTERVAL);
                }
            })
            .expect("failed to start the MIDI watcher thread");
        service
    }

    pub fn list_inputs() -> Result<Vec<String>, String> {
        let input = MidiInput::new(CLIENT).map_err(|e| e.to_string())?;
        Ok(input
            .ports()
            .iter()
            .filter_map(|p| input.port_name(p).ok())
            .collect())
    }

    pub fn connect(&self, name: &str) -> MidiStatus {
        let mut conn = self.connection.lock().unwrap();
        if conn.handle.take().is_some() {
            self.pipeline.release_all();
        }
        if conn.wanted.as_deref() != Some(name) {
            // A different device has to prove its capabilities from scratch.
            *self.pipeline.observer.lock().unwrap() = CapabilityObserver::default();
        }
        conn.wanted = Some(name.to_string());
        conn.connected = None;
        match self.open(name) {
            Ok(handle) => {
                conn.handle = Some(handle);
                conn.connected = Some(name.to_string());
                conn.error = None;
            }
            Err(e) => conn.error = Some(e),
        }
        let status = self.status_of(&conn);
        drop(conn);
        self.emit_status(&status);
        status
    }

    pub fn disconnect(&self) -> MidiStatus {
        let mut conn = self.connection.lock().unwrap();
        conn.wanted = None;
        conn.connected = None;
        conn.error = None;
        conn.handle.take();
        let status = self.status_of(&conn);
        drop(conn);
        self.pipeline.release_all();
        self.emit_status(&status);
        status
    }

    pub fn simulate(&self, bytes: &[u8]) {
        self.pipeline.handle(SIMULATOR, true, bytes);
    }

    pub fn release_all(&self) {
        self.pipeline.release_all();
    }

    pub fn status(&self) -> MidiStatus {
        self.status_of(&self.connection.lock().unwrap())
    }

    fn status_of(&self, conn: &Connection) -> MidiStatus {
        MidiStatus {
            connected: conn.connected.clone(),
            wanted: conn.wanted.clone(),
            capabilities: self.pipeline.observer.lock().unwrap().capabilities().into(),
            error: conn.error.clone(),
        }
    }

    fn emit_status(&self, status: &MidiStatus) {
        let _ = self.pipeline.app.emit("midi-status", status.clone());
    }

    fn open(&self, name: &str) -> Result<MidiInputConnection<()>, String> {
        let mut input = MidiInput::new(CLIENT).map_err(|e| e.to_string())?;
        // Drop SysEx, clock and active sensing; only channel messages matter here.
        input.ignore(Ignore::All);
        let port = input
            .ports()
            .into_iter()
            .find(|p| input.port_name(p).map(|n| n == name).unwrap_or(false))
            .ok_or_else(|| format!("MIDI device not found: {name}"))?;
        let pipeline = self.pipeline.clone();
        let device = name.to_string();
        input
            .connect(
                &port,
                "mimi-kopi-input",
                move |_, bytes, _| pipeline.handle(&device, false, bytes),
                (),
            )
            .map_err(|e| e.to_string())
    }

    fn watch_once(&self) {
        let Ok(names) = Self::list_inputs() else {
            return;
        };
        let mut conn = self.connection.lock().unwrap();
        let Some(wanted) = conn.wanted.clone() else {
            return;
        };
        let present = names.contains(&wanted);
        let changed = if conn.connected.is_some() && !present {
            conn.handle.take();
            conn.connected = None;
            conn.error = Some("MIDI device disconnected".into());
            self.pipeline.release_all();
            true
        } else if conn.connected.is_none() && present {
            match self.open(&wanted) {
                Ok(handle) => {
                    conn.handle = Some(handle);
                    conn.connected = Some(wanted);
                    conn.error = None;
                    true
                }
                Err(_) => false,
            }
        } else {
            false
        };
        if changed {
            let status = self.status_of(&conn);
            drop(conn);
            self.emit_status(&status);
        }
    }
}
