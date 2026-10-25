//! MIDI messages, device capabilities, key state and the input adapter
//! interface (spec §6.1, §8.4).
//!
//! Nothing here assumes what the Badger C-918 actually sends: capabilities
//! start as `NotYetTested` and are only changed by a real hardware test.

use std::collections::{BTreeSet, VecDeque};
use std::fmt;

/// A parsed MIDI channel message. Channels are 0-based (0–15).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MidiMessage {
    NoteOn {
        channel: u8,
        pitch: u8,
        velocity: u8,
    },
    NoteOff {
        channel: u8,
        pitch: u8,
        velocity: u8,
    },
    ControlChange {
        channel: u8,
        control: u8,
        value: u8,
    },
    /// A well-formed message this app does not use yet (pitch bend, clock, ...).
    Other,
}

/// MIDI CC number for the sustain (damper) pedal.
pub const CC_SUSTAIN: u8 = 64;

impl MidiMessage {
    /// Parses one complete MIDI message.
    ///
    /// Returns `None` for running-status data, truncated messages and data
    /// bytes with the high bit set. A Note On with velocity 0 is returned as
    /// a Note Off, as the MIDI spec requires.
    pub fn parse(bytes: &[u8]) -> Option<Self> {
        let (&status, data) = bytes.split_first()?;
        if status < 0x80 || data.iter().any(|&b| b >= 0x80) {
            return None;
        }
        let channel = status & 0x0F;
        match (status & 0xF0, data) {
            (0x90, [pitch, 0, ..]) => Some(Self::NoteOff {
                channel,
                pitch: *pitch,
                velocity: 0,
            }),
            (0x90, [pitch, velocity, ..]) => Some(Self::NoteOn {
                channel,
                pitch: *pitch,
                velocity: *velocity,
            }),
            (0x80, [pitch, velocity, ..]) => Some(Self::NoteOff {
                channel,
                pitch: *pitch,
                velocity: *velocity,
            }),
            (0xB0, [control, value, ..]) => Some(Self::ControlChange {
                channel,
                control: *control,
                value: *value,
            }),
            (0x80 | 0x90 | 0xB0, _) => None,
            _ => Some(Self::Other),
        }
    }
}

/// A message stamped with a monotonic time and the device it came from.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MidiEvent {
    /// Microseconds on a monotonic clock, never a UI render timestamp (spec §7.3).
    pub timestamp_us: u64,
    pub device_id: String,
    pub message: MidiMessage,
}

/// Whether a device feature has been confirmed on real hardware (spec §2.3).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum CapabilityStatus {
    Supported,
    NotSupported,
    #[default]
    NotYetTested,
}

impl CapabilityStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Supported => "supported",
            Self::NotSupported => "not_supported",
            Self::NotYetTested => "not_yet_tested",
        }
    }
}

/// What a specific input device has been shown to send.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct DeviceCapabilities {
    pub note_on_off: CapabilityStatus,
    pub velocity: CapabilityStatus,
    pub sustain_cc64: CapabilityStatus,
    pub polyphony: CapabilityStatus,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeviceInfo {
    pub id: String,
    pub name: String,
    /// True for the built-in simulator, so results from it are never
    /// reported as hardware results.
    pub simulated: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MidiError {
    DeviceNotFound(String),
    NotConnected,
}

impl fmt::Display for MidiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::DeviceNotFound(id) => write!(f, "MIDI device not found: {id}"),
            Self::NotConnected => write!(f, "no MIDI device is connected"),
        }
    }
}

impl std::error::Error for MidiError {}

/// A source of MIDI input. The native backend and the simulator both
/// implement it, so the practice engine never depends on which one runs.
pub trait MidiInputAdapter {
    fn list_devices(&self) -> Vec<DeviceInfo>;
    fn connect(&mut self, device_id: &str) -> Result<(), MidiError>;
    fn disconnect(&mut self);
    /// Takes the events received since the last call, oldest first.
    fn poll(&mut self) -> Result<Vec<MidiEvent>, MidiError>;
}

/// Which keys are down and whether the sustain pedal is held.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct KeyboardState {
    held: BTreeSet<(u8, u8)>,
    sustain: bool,
}

impl KeyboardState {
    pub fn apply(&mut self, message: &MidiMessage) {
        match *message {
            MidiMessage::NoteOn { channel, pitch, .. } => {
                self.held.insert((channel, pitch));
            }
            MidiMessage::NoteOff { channel, pitch, .. } => {
                self.held.remove(&(channel, pitch));
            }
            MidiMessage::ControlChange {
                control: CC_SUSTAIN,
                value,
                ..
            } => {
                self.sustain = value >= 64;
            }
            _ => {}
        }
    }

    pub fn is_held(&self, channel: u8, pitch: u8) -> bool {
        self.held.contains(&(channel, pitch))
    }

    pub fn held_pitches(&self) -> impl Iterator<Item = u8> + '_ {
        self.held.iter().map(|&(_, pitch)| pitch)
    }

    pub fn sustain(&self) -> bool {
        self.sustain
    }

    /// Releases everything, e.g. on disconnect or focus loss, so no key stays
    /// stuck on screen (spec §6.1). Returns the (channel, pitch) pairs that
    /// were still held, so the sound engine can stop them too.
    pub fn reset(&mut self) -> Vec<(u8, u8)> {
        self.sustain = false;
        std::mem::take(&mut self.held).into_iter().collect()
    }
}

/// A scripted input device for development, demos and tests.
#[derive(Debug, Default)]
pub struct SimulatedInput {
    connected: bool,
    queue: VecDeque<MidiEvent>,
}

impl SimulatedInput {
    pub const DEVICE_ID: &'static str = "simulator";

    /// Queues raw bytes as if the device had sent them at `timestamp_us`.
    /// Bytes that do not parse are dropped, like noise from a real port.
    pub fn push_raw(&mut self, timestamp_us: u64, bytes: &[u8]) {
        if let Some(message) = MidiMessage::parse(bytes) {
            self.queue.push_back(MidiEvent {
                timestamp_us,
                device_id: Self::DEVICE_ID.into(),
                message,
            });
        }
    }
}

impl MidiInputAdapter for SimulatedInput {
    fn list_devices(&self) -> Vec<DeviceInfo> {
        vec![DeviceInfo {
            id: Self::DEVICE_ID.into(),
            name: "Simulator".into(),
            simulated: true,
        }]
    }

    fn connect(&mut self, device_id: &str) -> Result<(), MidiError> {
        if device_id != Self::DEVICE_ID {
            return Err(MidiError::DeviceNotFound(device_id.into()));
        }
        self.connected = true;
        Ok(())
    }

    fn disconnect(&mut self) {
        self.connected = false;
        self.queue.clear();
    }

    fn poll(&mut self) -> Result<Vec<MidiEvent>, MidiError> {
        if !self.connected {
            return Err(MidiError::NotConnected);
        }
        Ok(self.queue.drain(..).collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_note_on_and_off() {
        assert_eq!(
            MidiMessage::parse(&[0x90, 60, 100]),
            Some(MidiMessage::NoteOn {
                channel: 0,
                pitch: 60,
                velocity: 100
            })
        );
        assert_eq!(
            MidiMessage::parse(&[0x83, 60, 40]),
            Some(MidiMessage::NoteOff {
                channel: 3,
                pitch: 60,
                velocity: 40
            })
        );
    }

    #[test]
    fn note_on_with_velocity_zero_is_note_off() {
        assert_eq!(
            MidiMessage::parse(&[0x91, 64, 0]),
            Some(MidiMessage::NoteOff {
                channel: 1,
                pitch: 64,
                velocity: 0
            })
        );
    }

    #[test]
    fn parses_sustain_pedal() {
        assert_eq!(
            MidiMessage::parse(&[0xB0, CC_SUSTAIN, 127]),
            Some(MidiMessage::ControlChange {
                channel: 0,
                control: CC_SUSTAIN,
                value: 127
            })
        );
    }

    #[test]
    fn rejects_malformed_messages() {
        assert_eq!(MidiMessage::parse(&[]), None);
        assert_eq!(
            MidiMessage::parse(&[60, 100]),
            None,
            "running status is not a full message"
        );
        assert_eq!(MidiMessage::parse(&[0x90, 60]), None, "truncated note on");
        assert_eq!(
            MidiMessage::parse(&[0x90, 0x80, 10]),
            None,
            "data byte with high bit"
        );
    }

    #[test]
    fn other_messages_are_recognised_but_ignored() {
        assert_eq!(MidiMessage::parse(&[0xE0, 0, 64]), Some(MidiMessage::Other));
        assert_eq!(MidiMessage::parse(&[0xF8]), Some(MidiMessage::Other));
    }

    #[test]
    fn capabilities_start_untested() {
        let caps = DeviceCapabilities::default();
        assert_eq!(caps.velocity, CapabilityStatus::NotYetTested);
        assert_eq!(caps.sustain_cc64.as_str(), "not_yet_tested");
    }

    #[test]
    fn keyboard_tracks_chords_and_repeated_pitches() {
        let mut keys = KeyboardState::default();
        for pitch in [60, 64, 67] {
            keys.apply(&MidiMessage::NoteOn {
                channel: 0,
                pitch,
                velocity: 90,
            });
        }
        assert_eq!(keys.held_pitches().collect::<Vec<_>>(), vec![60, 64, 67]);

        // The same pitch pressed again before its release stays a single held key.
        keys.apply(&MidiMessage::NoteOn {
            channel: 0,
            pitch: 60,
            velocity: 90,
        });
        keys.apply(&MidiMessage::NoteOff {
            channel: 0,
            pitch: 60,
            velocity: 0,
        });
        assert!(!keys.is_held(0, 60));
        assert!(keys.is_held(0, 64));
    }

    #[test]
    fn same_pitch_on_different_channels_is_separate() {
        let mut keys = KeyboardState::default();
        keys.apply(&MidiMessage::NoteOn {
            channel: 0,
            pitch: 60,
            velocity: 90,
        });
        keys.apply(&MidiMessage::NoteOn {
            channel: 1,
            pitch: 60,
            velocity: 90,
        });
        keys.apply(&MidiMessage::NoteOff {
            channel: 0,
            pitch: 60,
            velocity: 0,
        });
        assert!(keys.is_held(1, 60));
    }

    #[test]
    fn sustain_follows_cc64_threshold() {
        let mut keys = KeyboardState::default();
        keys.apply(&MidiMessage::ControlChange {
            channel: 0,
            control: CC_SUSTAIN,
            value: 64,
        });
        assert!(keys.sustain());
        keys.apply(&MidiMessage::ControlChange {
            channel: 0,
            control: CC_SUSTAIN,
            value: 63,
        });
        assert!(!keys.sustain());
    }

    #[test]
    fn reset_releases_stuck_keys() {
        let mut keys = KeyboardState::default();
        keys.apply(&MidiMessage::NoteOn {
            channel: 0,
            pitch: 60,
            velocity: 90,
        });
        keys.apply(&MidiMessage::ControlChange {
            channel: 0,
            control: CC_SUSTAIN,
            value: 127,
        });
        assert_eq!(keys.reset(), vec![(0, 60)]);
        assert_eq!(keys.held_pitches().count(), 0);
        assert!(!keys.sustain());
    }

    #[test]
    fn simulator_requires_connection_and_drains_in_order() {
        let mut sim = SimulatedInput::default();
        assert_eq!(sim.poll(), Err(MidiError::NotConnected));
        assert_eq!(
            sim.connect("badger"),
            Err(MidiError::DeviceNotFound("badger".into()))
        );
        assert!(sim.list_devices()[0].simulated);

        sim.connect(SimulatedInput::DEVICE_ID).unwrap();
        sim.push_raw(10, &[0x90, 60, 100]);
        sim.push_raw(20, &[0x90, 60]); // malformed, dropped
        sim.push_raw(30, &[0x90, 60, 0]);
        let events = sim.poll().unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].timestamp_us, 10);
        assert!(matches!(
            events[1].message,
            MidiMessage::NoteOff { pitch: 60, .. }
        ));
        assert!(sim.poll().unwrap().is_empty());
    }

    #[test]
    fn disconnect_drops_pending_events() {
        let mut sim = SimulatedInput::default();
        sim.connect(SimulatedInput::DEVICE_ID).unwrap();
        sim.push_raw(10, &[0x90, 60, 100]);
        sim.disconnect();
        sim.connect(SimulatedInput::DEVICE_ID).unwrap();
        assert!(sim.poll().unwrap().is_empty());
    }
}
