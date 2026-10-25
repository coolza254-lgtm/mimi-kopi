//! Learns what an input device sends by watching its events (spec §2.3).
//!
//! The observer only ever upgrades a capability to `Supported`. Not seeing a
//! pedal or varied velocities is not proof the device lacks them, so nothing
//! is marked `NotSupported` automatically.

use std::collections::BTreeSet;

use crate::midi::{CapabilityStatus, DeviceCapabilities, KeyboardState, MidiMessage, CC_SUSTAIN};

/// Distinct Note On velocities needed before velocity counts as supported.
/// A keyboard without touch response sends one fixed value.
const VELOCITY_VARIETY: usize = 3;

/// Keys held at the same time before polyphony counts as supported (a triad).
const POLYPHONY_KEYS: usize = 3;

#[derive(Debug, Default, Clone)]
pub struct CapabilityObserver {
    caps: DeviceCapabilities,
    saw_note_on: bool,
    saw_note_off: bool,
    velocities: BTreeSet<u8>,
    keys: KeyboardState,
}

impl CapabilityObserver {
    pub fn observe(&mut self, message: &MidiMessage) {
        self.keys.apply(message);
        match *message {
            MidiMessage::NoteOn { velocity, .. } => {
                self.saw_note_on = true;
                self.velocities.insert(velocity);
            }
            MidiMessage::NoteOff { .. } => self.saw_note_off = true,
            MidiMessage::ControlChange {
                control: CC_SUSTAIN,
                ..
            } => {
                self.caps.sustain_cc64 = CapabilityStatus::Supported;
            }
            _ => {}
        }
        if self.saw_note_on && self.saw_note_off {
            self.caps.note_on_off = CapabilityStatus::Supported;
        }
        if self.velocities.len() >= VELOCITY_VARIETY {
            self.caps.velocity = CapabilityStatus::Supported;
        }
        if self.keys.held_pitches().count() >= POLYPHONY_KEYS {
            self.caps.polyphony = CapabilityStatus::Supported;
        }
    }

    pub fn capabilities(&self) -> DeviceCapabilities {
        self.caps
    }

    /// Forgets held keys after a disconnect without losing what was learned.
    pub fn release_keys(&mut self) {
        self.keys.reset();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn on(pitch: u8, velocity: u8) -> MidiMessage {
        MidiMessage::NoteOn {
            channel: 0,
            pitch,
            velocity,
        }
    }

    fn off(pitch: u8) -> MidiMessage {
        MidiMessage::NoteOff {
            channel: 0,
            pitch,
            velocity: 0,
        }
    }

    #[test]
    fn starts_untested() {
        assert_eq!(
            CapabilityObserver::default().capabilities(),
            DeviceCapabilities::default()
        );
    }

    #[test]
    fn note_on_off_needs_both_directions() {
        let mut obs = CapabilityObserver::default();
        obs.observe(&on(60, 80));
        assert_eq!(
            obs.capabilities().note_on_off,
            CapabilityStatus::NotYetTested
        );
        obs.observe(&off(60));
        assert_eq!(obs.capabilities().note_on_off, CapabilityStatus::Supported);
    }

    #[test]
    fn fixed_velocity_is_not_proof_of_velocity_support() {
        let mut obs = CapabilityObserver::default();
        for _ in 0..10 {
            obs.observe(&on(60, 100));
            obs.observe(&off(60));
        }
        assert_eq!(obs.capabilities().velocity, CapabilityStatus::NotYetTested);
        for v in [30, 64, 110] {
            obs.observe(&on(62, v));
            obs.observe(&off(62));
        }
        assert_eq!(obs.capabilities().velocity, CapabilityStatus::Supported);
    }

    #[test]
    fn triad_shows_polyphony_but_arpeggio_does_not() {
        let mut obs = CapabilityObserver::default();
        for p in [60, 64, 67] {
            obs.observe(&on(p, 80));
            obs.observe(&off(p));
        }
        assert_eq!(obs.capabilities().polyphony, CapabilityStatus::NotYetTested);
        for p in [60, 64, 67] {
            obs.observe(&on(p, 80));
        }
        assert_eq!(obs.capabilities().polyphony, CapabilityStatus::Supported);
    }

    #[test]
    fn sustain_pedal_is_detected_and_nothing_becomes_unsupported() {
        let mut obs = CapabilityObserver::default();
        obs.observe(&MidiMessage::ControlChange {
            channel: 0,
            control: CC_SUSTAIN,
            value: 0,
        });
        let caps = obs.capabilities();
        assert_eq!(caps.sustain_cc64, CapabilityStatus::Supported);
        assert_ne!(caps.velocity, CapabilityStatus::NotSupported);
        assert_ne!(caps.polyphony, CapabilityStatus::NotSupported);
    }

    #[test]
    fn release_keys_keeps_learned_capabilities() {
        let mut obs = CapabilityObserver::default();
        for p in [60, 64, 67] {
            obs.observe(&on(p, 80));
        }
        obs.release_keys();
        obs.observe(&on(72, 80));
        assert_eq!(obs.capabilities().polyphony, CapabilityStatus::Supported);
    }
}
