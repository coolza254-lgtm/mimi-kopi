//! Instruments the audio callback can play (spec §6.2): a basic built-in
//! piano tone that works without any SoundFont, and a SoundFont piano via
//! RustySynth for a user-chosen, licensed `.sf2` file.
//!
//! After construction nothing here allocates, locks or does I/O, so these
//! methods are safe to call from the real-time audio callback (spec §7.3).

use std::f32::consts::TAU;
use std::io::Read;
use std::sync::Arc;

pub use rustysynth::SoundFont;
use rustysynth::{Synthesizer, SynthesizerSettings};

pub trait Instrument: Send {
    fn note_on(&mut self, pitch: u8, velocity: u8);
    fn note_off(&mut self, pitch: u8);
    fn set_sustain(&mut self, on: bool);
    /// Releases every voice, e.g. after a MIDI disconnect.
    fn all_notes_off(&mut self);
    /// Overwrites `left` and `right` (same length) with the next block.
    fn render(&mut self, left: &mut [f32], right: &mut [f32]);
}

const MAX_VOICES: usize = 32;
const ATTACK_SECONDS: f32 = 0.005;
/// Time constant of the natural decay while a key (or the pedal) holds a note.
const DECAY_SECONDS: f32 = 1.6;
/// Time constant after release; short, like a damper landing on the string.
const RELEASE_SECONDS: f32 = 0.12;
/// -60 dB: inaudible at VOICE_LEVEL, and reached within a second of release.
const SILENT: f32 = 1e-3;
/// Leaves headroom for a two-handed chord before the master gain.
const VOICE_LEVEL: f32 = 0.18;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Phase {
    Idle,
    Held,
    Releasing,
}

#[derive(Debug, Clone, Copy)]
struct Voice {
    pitch: u8,
    phase: Phase,
    key_down: bool,
    osc: f32,
    step: f32,
    level: f32,
    env: f32,
    attack_left: u32,
}

impl Voice {
    const IDLE: Self = Self {
        pitch: 0,
        phase: Phase::Idle,
        key_down: false,
        osc: 0.0,
        step: 0.0,
        level: 0.0,
        env: 0.0,
        attack_left: 0,
    };
}

/// A simple additive piano-like tone. Not a substitute for a real sampled
/// piano, but it lets the app make sound before a SoundFont is chosen.
#[derive(Debug, Clone)]
pub struct BasicPiano {
    voices: [Voice; MAX_VOICES],
    sustain: bool,
    sample_rate: f32,
    attack_samples: u32,
    decay: f32,
    release: f32,
}

impl BasicPiano {
    pub fn new(sample_rate: u32) -> Self {
        let sr = sample_rate.max(1) as f32;
        Self {
            voices: [Voice::IDLE; MAX_VOICES],
            sustain: false,
            sample_rate: sr,
            attack_samples: (ATTACK_SECONDS * sr).max(1.0) as u32,
            decay: (-1.0 / (DECAY_SECONDS * sr)).exp(),
            release: (-1.0 / (RELEASE_SECONDS * sr)).exp(),
        }
    }

    pub fn active_voices(&self) -> usize {
        self.voices
            .iter()
            .filter(|v| v.phase != Phase::Idle)
            .count()
    }

    fn release_unheld(&mut self) {
        for v in &mut self.voices {
            if v.phase == Phase::Held && !v.key_down {
                v.phase = Phase::Releasing;
            }
        }
    }
}

impl Instrument for BasicPiano {
    fn note_on(&mut self, pitch: u8, velocity: u8) {
        // Retrigger the same pitch, else take a free voice, else steal the quietest.
        let index = self
            .voices
            .iter()
            .position(|v| v.phase != Phase::Idle && v.pitch == pitch)
            .or_else(|| self.voices.iter().position(|v| v.phase == Phase::Idle))
            .unwrap_or_else(|| {
                (0..MAX_VOICES)
                    .min_by(|&a, &b| self.voices[a].env.total_cmp(&self.voices[b].env))
                    .unwrap_or(0)
            });
        let freq = 440.0 * 2f32.powf((f32::from(pitch) - 69.0) / 12.0);
        let v = f32::from(velocity.min(127)) / 127.0;
        self.voices[index] = Voice {
            pitch,
            phase: Phase::Held,
            key_down: true,
            osc: 0.0,
            step: freq / self.sample_rate,
            level: v * v.sqrt() * VOICE_LEVEL,
            env: 0.0,
            attack_left: self.attack_samples,
        };
    }

    fn note_off(&mut self, pitch: u8) {
        for v in &mut self.voices {
            if v.phase == Phase::Held && v.pitch == pitch && v.key_down {
                v.key_down = false;
                if !self.sustain {
                    v.phase = Phase::Releasing;
                }
            }
        }
    }

    fn set_sustain(&mut self, on: bool) {
        self.sustain = on;
        if !on {
            self.release_unheld();
        }
    }

    fn all_notes_off(&mut self) {
        self.sustain = false;
        for v in &mut self.voices {
            v.key_down = false;
            if v.phase == Phase::Held {
                v.phase = Phase::Releasing;
            }
        }
    }

    fn render(&mut self, left: &mut [f32], right: &mut [f32]) {
        let attack_step = 1.0 / self.attack_samples as f32;
        for (l, r) in left.iter_mut().zip(right.iter_mut()) {
            let mut sum = 0.0;
            for v in &mut self.voices {
                if v.phase == Phase::Idle {
                    continue;
                }
                if v.attack_left > 0 {
                    v.env = (v.env + attack_step).min(1.0);
                    v.attack_left -= 1;
                } else {
                    v.env *= if v.phase == Phase::Releasing {
                        self.release
                    } else {
                        self.decay
                    };
                    if v.env < SILENT {
                        *v = Voice::IDLE;
                        continue;
                    }
                }
                let p = TAU * v.osc;
                let tone = (p.sin() + 0.5 * (2.0 * p).sin() + 0.25 * (3.0 * p).sin()) / 1.75;
                sum += tone * v.env * v.level;
                v.osc += v.step;
                if v.osc >= 1.0 {
                    v.osc -= 1.0;
                }
            }
            *l = sum;
            *r = sum;
        }
    }
}

/// Parses a SoundFont. Do this off the audio thread: files can be large.
pub fn load_sound_font<R: Read>(reader: &mut R) -> Result<Arc<SoundFont>, String> {
    SoundFont::new(reader)
        .map(Arc::new)
        .map_err(|e| format!("{e:?}"))
}

/// A SoundFont piano on MIDI channel 0 (General MIDI program 0 by default).
pub struct SoundFontPiano {
    synth: Synthesizer,
}

impl SoundFontPiano {
    pub fn new(sound_font: &Arc<SoundFont>, sample_rate: u32) -> Result<Self, String> {
        let rate =
            i32::try_from(sample_rate).map_err(|_| "sample rate out of range".to_string())?;
        let settings = SynthesizerSettings::new(rate);
        Synthesizer::new(sound_font, &settings)
            .map(|synth| Self { synth })
            .map_err(|e| format!("{e:?}"))
    }
}

impl Instrument for SoundFontPiano {
    fn note_on(&mut self, pitch: u8, velocity: u8) {
        self.synth.note_on(0, i32::from(pitch), i32::from(velocity));
    }

    fn note_off(&mut self, pitch: u8) {
        self.synth.note_off(0, i32::from(pitch));
    }

    fn set_sustain(&mut self, on: bool) {
        self.synth
            .process_midi_message(0, 0xB0, 64, if on { 127 } else { 0 });
    }

    fn all_notes_off(&mut self) {
        self.synth.process_midi_message(0, 0xB0, 64, 0);
        self.synth.note_off_all(false);
    }

    fn render(&mut self, left: &mut [f32], right: &mut [f32]) {
        self.synth.render(left, right);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SR: u32 = 48_000;

    fn energy(piano: &mut BasicPiano, frames: usize) -> f32 {
        let mut l = vec![0.0; frames];
        let mut r = vec![0.0; frames];
        piano.render(&mut l, &mut r);
        assert_eq!(l, r, "basic piano is mono on both sides");
        l.iter().map(|s| s * s).sum::<f32>() / frames as f32
    }

    #[test]
    fn silent_until_a_note_plays() {
        let mut piano = BasicPiano::new(SR);
        assert_eq!(energy(&mut piano, 512), 0.0);
        piano.note_on(60, 100);
        assert!(energy(&mut piano, 512) > 0.0);
    }

    #[test]
    fn released_note_falls_silent_and_frees_its_voice() {
        let mut piano = BasicPiano::new(SR);
        piano.note_on(60, 100);
        energy(&mut piano, 1024);
        piano.note_off(60);
        energy(&mut piano, SR as usize); // one second is many release time constants
        assert_eq!(piano.active_voices(), 0);
        assert_eq!(energy(&mut piano, 256), 0.0);
    }

    #[test]
    fn sustain_holds_released_keys_until_pedal_up() {
        let mut piano = BasicPiano::new(SR);
        piano.set_sustain(true);
        piano.note_on(64, 90);
        piano.note_off(64);
        energy(&mut piano, SR as usize / 4);
        assert_eq!(piano.active_voices(), 1, "pedal keeps the note ringing");
        piano.set_sustain(false);
        energy(&mut piano, SR as usize);
        assert_eq!(piano.active_voices(), 0);
    }

    #[test]
    fn repeated_pitch_reuses_its_voice() {
        let mut piano = BasicPiano::new(SR);
        piano.note_on(60, 100);
        piano.note_on(60, 100);
        assert_eq!(piano.active_voices(), 1);
    }

    #[test]
    fn more_notes_than_voices_steals_instead_of_failing() {
        let mut piano = BasicPiano::new(SR);
        for p in 21..(21 + MAX_VOICES as u8 + 8) {
            piano.note_on(p, 80);
        }
        assert_eq!(piano.active_voices(), MAX_VOICES);
        assert!(energy(&mut piano, 256).is_finite());
    }

    #[test]
    fn velocity_changes_loudness() {
        let mut soft = BasicPiano::new(SR);
        let mut loud = BasicPiano::new(SR);
        soft.note_on(60, 30);
        loud.note_on(60, 120);
        assert!(energy(&mut loud, 2048) > energy(&mut soft, 2048));
    }

    #[test]
    fn all_notes_off_releases_even_with_pedal_down() {
        let mut piano = BasicPiano::new(SR);
        piano.set_sustain(true);
        piano.note_on(60, 100);
        piano.note_on(67, 100);
        piano.all_notes_off();
        energy(&mut piano, SR as usize);
        assert_eq!(piano.active_voices(), 0);
    }

    #[test]
    fn invalid_sound_font_is_an_error_not_a_panic() {
        let mut garbage: &[u8] = b"RIFF\x04\x00\x00\x00junk";
        assert!(load_sound_font(&mut garbage).is_err());
    }
}
