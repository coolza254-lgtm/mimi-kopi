//! What the audio callback consumes: note commands, gains and a renderer
//! that turns instrument output into the device's interleaved frames.

use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;

use crate::midi::{MidiMessage, CC_SUSTAIN};
use crate::synth::Instrument;
use crate::tone::{Effects, ToneSettings};

/// Sent from the MIDI side to the audio callback through a lock-free queue.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AudioCommand {
    NoteOn { pitch: u8, velocity: u8 },
    NoteOff { pitch: u8 },
    Sustain(bool),
    AllNotesOff,
}

impl AudioCommand {
    /// The command a MIDI message should trigger, if any. Channel is ignored:
    /// a piano keyboard plays one instrument whatever channel it sends on.
    pub fn from_midi(message: &MidiMessage) -> Option<Self> {
        match *message {
            MidiMessage::NoteOn {
                pitch, velocity, ..
            } => Some(Self::NoteOn { pitch, velocity }),
            MidiMessage::NoteOff { pitch, .. } => Some(Self::NoteOff { pitch }),
            MidiMessage::ControlChange {
                control: CC_SUSTAIN,
                value,
                ..
            } => Some(Self::Sustain(value >= 64)),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Channel {
    Master,
    Piano,
    Metronome,
    Backing,
}

impl Channel {
    pub fn parse(name: &str) -> Option<Self> {
        match name {
            "master" => Some(Self::Master),
            "piano" => Some(Self::Piano),
            "metronome" => Some(Self::Metronome),
            "backing" => Some(Self::Backing),
            _ => None,
        }
    }

    fn index(self) -> usize {
        self as usize
    }
}

/// Mixer gains, written by the UI and read by the audio callback without locking.
#[derive(Debug)]
pub struct Gains {
    values: [AtomicU32; 4],
}

impl Default for Gains {
    fn default() -> Self {
        let g = |v: f32| AtomicU32::new(v.to_bits());
        Self {
            values: [g(0.8), g(0.8), g(0.6), g(0.6)],
        }
    }
}

impl Gains {
    /// Clamps to 0..=1; anything that is not a number becomes silence.
    pub fn set(&self, channel: Channel, value: f32) {
        let v = if value.is_nan() {
            0.0
        } else {
            value.clamp(0.0, 1.0)
        };
        self.values[channel.index()].store(v.to_bits(), Ordering::Relaxed);
    }

    pub fn get(&self, channel: Channel) -> f32 {
        f32::from_bits(self.values[channel.index()].load(Ordering::Relaxed))
    }
}

/// Frames rendered per instrument call; scratch buffers are sized once.
const BLOCK: usize = 1024;

pub struct Renderer {
    instrument: Box<dyn Instrument>,
    effects: Effects,
    tone: Arc<ToneSettings>,
    left: Vec<f32>,
    right: Vec<f32>,
}

impl Renderer {
    pub fn new(instrument: Box<dyn Instrument>, sample_rate: u32, tone: Arc<ToneSettings>) -> Self {
        Self {
            instrument,
            effects: Effects::new(sample_rate),
            tone,
            left: vec![0.0; BLOCK],
            right: vec![0.0; BLOCK],
        }
    }

    pub fn apply(&mut self, command: AudioCommand) {
        match command {
            AudioCommand::NoteOn { pitch, velocity } => {
                self.instrument.note_on(pitch, self.tone.velocity(velocity))
            }
            AudioCommand::NoteOff { pitch } => self.instrument.note_off(pitch),
            AudioCommand::Sustain(on) => self.instrument.set_sustain(on),
            AudioCommand::AllNotesOff => self.instrument.all_notes_off(),
        }
    }

    /// Fills `out`, which holds `channels` interleaved samples per frame. A mono
    /// device gets the average of left and right; channels past the second are
    /// silent. Output is clamped to -1..=1 so integer formats cannot wrap.
    pub fn render_interleaved(&mut self, out: &mut [f32], channels: usize, gains: &Gains) {
        if channels == 0 {
            return;
        }
        let gain = gains.get(Channel::Master) * gains.get(Channel::Piano);
        let Self {
            instrument,
            effects,
            tone,
            left,
            right,
        } = self;
        for chunk in out.chunks_mut(BLOCK * channels) {
            let frames = chunk.len() / channels;
            let (l, r) = (&mut left[..frames], &mut right[..frames]);
            instrument.render(l, r);
            effects.process(l, r, tone);
            for (i, frame) in chunk.chunks_exact_mut(channels).enumerate() {
                if channels == 1 {
                    frame[0] = ((l[i] + r[i]) * 0.5 * gain).clamp(-1.0, 1.0);
                } else {
                    frame[0] = (l[i] * gain).clamp(-1.0, 1.0);
                    frame[1] = (r[i] * gain).clamp(-1.0, 1.0);
                    frame[2..].fill(0.0);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::synth::BasicPiano;

    fn renderer() -> Renderer {
        Renderer::new(
            Box::new(BasicPiano::new(48_000)),
            48_000,
            Arc::new(ToneSettings::default()),
        )
    }

    #[test]
    fn maps_midi_to_commands() {
        let on = MidiMessage::NoteOn {
            channel: 3,
            pitch: 60,
            velocity: 90,
        };
        assert_eq!(
            AudioCommand::from_midi(&on),
            Some(AudioCommand::NoteOn {
                pitch: 60,
                velocity: 90
            })
        );
        let pedal = MidiMessage::ControlChange {
            channel: 0,
            control: CC_SUSTAIN,
            value: 100,
        };
        assert_eq!(
            AudioCommand::from_midi(&pedal),
            Some(AudioCommand::Sustain(true))
        );
        let other_cc = MidiMessage::ControlChange {
            channel: 0,
            control: 7,
            value: 100,
        };
        assert_eq!(AudioCommand::from_midi(&other_cc), None);
    }

    #[test]
    fn gains_clamp_and_reject_nan() {
        let g = Gains::default();
        g.set(Channel::Piano, 1.7);
        assert_eq!(g.get(Channel::Piano), 1.0);
        g.set(Channel::Master, -0.2);
        assert_eq!(g.get(Channel::Master), 0.0);
        g.set(Channel::Metronome, f32::NAN);
        assert_eq!(g.get(Channel::Metronome), 0.0);
        assert_eq!(Channel::parse("backing"), Some(Channel::Backing));
        assert_eq!(Channel::parse("drums"), None);
    }

    #[test]
    fn plays_notes_into_stereo_frames() {
        let mut r = renderer();
        let gains = Gains::default();
        let mut out = vec![0.0; 2 * 512];
        r.render_interleaved(&mut out, 2, &gains);
        assert!(out.iter().all(|&s| s == 0.0));
        r.apply(AudioCommand::NoteOn {
            pitch: 60,
            velocity: 100,
        });
        r.render_interleaved(&mut out, 2, &gains);
        assert!(out.iter().any(|&s| s != 0.0));
        assert!(out.chunks(2).all(|f| f[0] == f[1]));
    }

    #[test]
    fn zero_master_gain_is_silent() {
        let mut r = renderer();
        let gains = Gains::default();
        gains.set(Channel::Master, 0.0);
        r.apply(AudioCommand::NoteOn {
            pitch: 60,
            velocity: 127,
        });
        let mut out = vec![0.5; 2 * 256];
        r.render_interleaved(&mut out, 2, &gains);
        assert!(out.iter().all(|&s| s == 0.0));
    }

    #[test]
    fn handles_mono_surround_and_buffers_longer_than_a_block() {
        let gains = Gains::default();
        let mut r = renderer();
        r.apply(AudioCommand::NoteOn {
            pitch: 69,
            velocity: 100,
        });
        let mut mono = vec![0.0; BLOCK * 3 + 17];
        r.render_interleaved(&mut mono, 1, &gains);
        assert!(
            mono[BLOCK * 2..].iter().any(|&s| s != 0.0),
            "later blocks are rendered too"
        );

        let mut six = vec![1.0; 6 * 100];
        r.render_interleaved(&mut six, 6, &gains);
        assert!(six.chunks(6).all(|f| f[2..].iter().all(|&s| s == 0.0)));
    }

    #[test]
    fn output_stays_in_range_with_many_loud_notes() {
        let gains = Gains::default();
        gains.set(Channel::Master, 1.0);
        gains.set(Channel::Piano, 1.0);
        let mut r = renderer();
        for p in 40..80 {
            r.apply(AudioCommand::NoteOn {
                pitch: p,
                velocity: 127,
            });
        }
        let mut out = vec![0.0; 2 * 4096];
        r.render_interleaved(&mut out, 2, &gains);
        assert!(out.iter().all(|s| (-1.0..=1.0).contains(s)));
    }

    #[test]
    fn fixed_touch_plays_soft_and_hard_presses_equally() {
        let gains = Gains::default();
        let loudness = |velocity: u8| {
            let tone = Arc::new(ToneSettings::default());
            tone.set_touch(crate::tone::Touch::Fixed, 90);
            let mut r = Renderer::new(Box::new(BasicPiano::new(48_000)), 48_000, tone);
            r.apply(AudioCommand::NoteOn {
                pitch: 60,
                velocity,
            });
            let mut out = vec![0.0; 2 * 2048];
            r.render_interleaved(&mut out, 2, &gains);
            out.iter().map(|s| s * s).sum::<f32>()
        };
        assert_eq!(loudness(20), loudness(127));
    }
}
