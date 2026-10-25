//! Sound shaping the player can change while playing (free piano mode):
//! how key velocity maps to loudness ("touch"), reverb and brightness.
//!
//! Settings are atomics written by the UI and read by the audio callback.
//! `Effects` allocates its delay lines once in `new`, so `process` is safe
//! in the real-time callback.

use std::sync::atomic::{AtomicU32, AtomicU8, Ordering};

/// How hard a key must be pressed for a given loudness.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Touch {
    /// What the keyboard sends.
    Natural,
    /// Soft presses sound louder, for players still learning even pressure.
    Light,
    /// Needs firmer presses, for players who hit hard.
    Heavy,
    /// Every note at the same level, however the key is pressed.
    Fixed,
}

impl Touch {
    pub fn parse(name: &str) -> Option<Self> {
        match name {
            "natural" => Some(Self::Natural),
            "light" => Some(Self::Light),
            "heavy" => Some(Self::Heavy),
            "fixed" => Some(Self::Fixed),
            _ => None,
        }
    }

    fn from_u8(v: u8) -> Self {
        match v {
            1 => Self::Light,
            2 => Self::Heavy,
            3 => Self::Fixed,
            _ => Self::Natural,
        }
    }

    fn as_u8(self) -> u8 {
        match self {
            Self::Natural => 0,
            Self::Light => 1,
            Self::Heavy => 2,
            Self::Fixed => 3,
        }
    }

    /// The velocity the instrument should play. Never 0, which MIDI treats
    /// as note off.
    pub fn apply(self, velocity: u8, fixed: u8) -> u8 {
        let v = f32::from(velocity.clamp(1, 127)) / 127.0;
        let shaped = match self {
            Self::Natural => return velocity.clamp(1, 127),
            Self::Fixed => return fixed.clamp(1, 127),
            Self::Light => v.powf(0.5),
            Self::Heavy => v.powf(1.6),
        };
        (shaped * 127.0).round().clamp(1.0, 127.0) as u8
    }
}

/// Written by the UI thread, read by the audio callback without locking.
#[derive(Debug)]
pub struct ToneSettings {
    touch: AtomicU8,
    fixed_velocity: AtomicU8,
    reverb: AtomicU32,
    brightness: AtomicU32,
}

impl Default for ToneSettings {
    fn default() -> Self {
        Self {
            touch: AtomicU8::new(Touch::Natural.as_u8()),
            fixed_velocity: AtomicU8::new(90),
            reverb: AtomicU32::new(0.0f32.to_bits()),
            brightness: AtomicU32::new(1.0f32.to_bits()),
        }
    }
}

fn unit(value: f32) -> f32 {
    if value.is_nan() {
        0.0
    } else {
        value.clamp(0.0, 1.0)
    }
}

impl ToneSettings {
    pub fn set_touch(&self, touch: Touch, fixed_velocity: u8) {
        self.touch.store(touch.as_u8(), Ordering::Relaxed);
        self.fixed_velocity
            .store(fixed_velocity.clamp(1, 127), Ordering::Relaxed);
    }

    /// 0 = dry, 1 = a large, wet room.
    pub fn set_reverb(&self, amount: f32) {
        self.reverb.store(unit(amount).to_bits(), Ordering::Relaxed);
    }

    /// 0 = dark and soft, 1 = the instrument as recorded.
    pub fn set_brightness(&self, amount: f32) {
        self.brightness
            .store(unit(amount).to_bits(), Ordering::Relaxed);
    }

    pub fn velocity(&self, velocity: u8) -> u8 {
        Touch::from_u8(self.touch.load(Ordering::Relaxed))
            .apply(velocity, self.fixed_velocity.load(Ordering::Relaxed))
    }

    pub fn reverb(&self) -> f32 {
        f32::from_bits(self.reverb.load(Ordering::Relaxed))
    }

    pub fn brightness(&self) -> f32 {
        f32::from_bits(self.brightness.load(Ordering::Relaxed))
    }
}

/// Freeverb-style comb filter.
struct Comb {
    buffer: Vec<f32>,
    index: usize,
    store: f32,
}

impl Comb {
    fn new(len: usize) -> Self {
        Self {
            buffer: vec![0.0; len.max(1)],
            index: 0,
            store: 0.0,
        }
    }

    fn process(&mut self, input: f32, feedback: f32, damp: f32) -> f32 {
        let out = self.buffer[self.index];
        self.store = out * (1.0 - damp) + self.store * damp;
        self.buffer[self.index] = input + self.store * feedback;
        self.index = (self.index + 1) % self.buffer.len();
        out
    }
}

struct Allpass {
    buffer: Vec<f32>,
    index: usize,
}

impl Allpass {
    fn new(len: usize) -> Self {
        Self {
            buffer: vec![0.0; len.max(1)],
            index: 0,
        }
    }

    fn process(&mut self, input: f32) -> f32 {
        let delayed = self.buffer[self.index];
        self.buffer[self.index] = input + delayed * 0.5;
        self.index = (self.index + 1) % self.buffer.len();
        delayed - input
    }
}

/// Delay lengths at 44.1 kHz from the public-domain Freeverb design.
const COMBS: [usize; 8] = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617];
const ALLPASSES: [usize; 4] = [556, 441, 341, 225];
const SPREAD: usize = 23;
const FEEDBACK: f32 = 0.84;
const DAMP: f32 = 0.25;
const INPUT_GAIN: f32 = 0.015;
/// Wet level at full reverb; the dry signal stays at full level.
const WET: f32 = 0.9;

/// Reverb and brightness applied after the instrument, before the gains.
pub struct Effects {
    combs: [Vec<Comb>; 2],
    allpasses: [Vec<Allpass>; 2],
    lowpass: [f32; 2],
    sample_rate: f32,
}

impl Effects {
    pub fn new(sample_rate: u32) -> Self {
        let scale = sample_rate.max(1) as f32 / 44_100.0;
        let len = |n: usize| ((n as f32) * scale) as usize;
        let side = |spread: usize| {
            (
                COMBS.iter().map(|&n| Comb::new(len(n + spread))).collect(),
                ALLPASSES
                    .iter()
                    .map(|&n| Allpass::new(len(n + spread)))
                    .collect(),
            )
        };
        let (cl, al) = side(0);
        let (cr, ar) = side(SPREAD);
        Self {
            combs: [cl, cr],
            allpasses: [al, ar],
            lowpass: [0.0; 2],
            sample_rate: sample_rate.max(1) as f32,
        }
    }

    /// Processes `left` and `right` in place.
    pub fn process(&mut self, left: &mut [f32], right: &mut [f32], settings: &ToneSettings) {
        let brightness = settings.brightness();
        if brightness < 1.0 {
            // 1.2 kHz when darkest, opening up to 18 kHz.
            let cutoff = 1_200.0 * 15f32.powf(brightness);
            let a = 1.0 - (-std::f32::consts::TAU * cutoff / self.sample_rate).exp();
            for (side, buf) in [&mut *left, &mut *right].into_iter().enumerate() {
                let mut y = self.lowpass[side];
                for s in buf.iter_mut() {
                    y += a * (*s - y);
                    *s = y;
                }
                self.lowpass[side] = y;
            }
        }
        let wet = settings.reverb() * WET;
        if wet <= 0.0 {
            return;
        }
        for (l, r) in left.iter_mut().zip(right.iter_mut()) {
            let input = (*l + *r) * INPUT_GAIN;
            let mut out = [0.0f32; 2];
            for ((acc, combs), allpasses) in
                out.iter_mut().zip(&mut self.combs).zip(&mut self.allpasses)
            {
                for comb in combs {
                    *acc += comb.process(input, FEEDBACK, DAMP);
                }
                for allpass in allpasses {
                    *acc = allpass.process(*acc);
                }
            }
            *l += out[0] * wet;
            *r += out[1] * wet;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SR: u32 = 48_000;

    #[test]
    fn touch_curves() {
        assert_eq!(Touch::Natural.apply(40, 90), 40);
        assert_eq!(Touch::Fixed.apply(10, 90), 90);
        assert_eq!(
            Touch::Fixed.apply(127, 0),
            1,
            "fixed level is never note off"
        );
        assert!(Touch::Light.apply(40, 90) > 40, "soft presses get louder");
        assert!(Touch::Heavy.apply(40, 90) < 40);
        for t in [Touch::Light, Touch::Heavy] {
            assert_eq!(t.apply(127, 0), 127);
            assert!(t.apply(1, 0) >= 1);
        }
        assert_eq!(Touch::parse("fixed"), Some(Touch::Fixed));
        assert_eq!(Touch::parse("loud"), None);
    }

    #[test]
    fn settings_round_trip_and_clamp() {
        let s = ToneSettings::default();
        assert_eq!(s.velocity(33), 33, "natural by default");
        s.set_touch(Touch::Fixed, 200);
        assert_eq!(s.velocity(5), 127);
        s.set_reverb(f32::NAN);
        assert_eq!(s.reverb(), 0.0);
        s.set_brightness(3.0);
        assert_eq!(s.brightness(), 1.0);
    }

    fn impulse(fx: &mut Effects, settings: &ToneSettings, frames: usize) -> (Vec<f32>, Vec<f32>) {
        let mut l = vec![0.0; frames];
        let mut r = vec![0.0; frames];
        l[0] = 1.0;
        r[0] = 1.0;
        fx.process(&mut l, &mut r, settings);
        (l, r)
    }

    #[test]
    fn defaults_leave_the_sound_untouched() {
        let mut fx = Effects::new(SR);
        let (l, r) = impulse(&mut fx, &ToneSettings::default(), 4800);
        assert_eq!(l[0], 1.0);
        assert!(l[1..].iter().chain(&r[1..]).all(|&s| s == 0.0));
    }

    #[test]
    fn reverb_adds_a_tail_that_dies_away() {
        let settings = ToneSettings::default();
        settings.set_reverb(1.0);
        let mut fx = Effects::new(SR);
        let (l, r) = impulse(&mut fx, &settings, SR as usize / 2);
        let tail: f32 = l[2400..].iter().map(|s| s.abs()).sum();
        assert!(tail > 0.0, "echoes after 50 ms");
        assert_ne!(l, r, "left and right differ for width");
        let mut silence_l = vec![0.0; SR as usize * 6];
        let mut silence_r = silence_l.clone();
        fx.process(&mut silence_l, &mut silence_r, &settings);
        let end = &silence_l[silence_l.len() - 4800..];
        assert!(end.iter().all(|s| s.abs() < 1e-4 && s.is_finite()));
    }

    #[test]
    fn low_brightness_softens_high_notes() {
        let settings = ToneSettings::default();
        settings.set_brightness(0.0);
        let mut fx = Effects::new(SR);
        // Alternating samples: the highest frequency there is.
        let mut l: Vec<f32> = (0..4800)
            .map(|i| if i % 2 == 0 { 0.5 } else { -0.5 })
            .collect();
        let mut r = l.clone();
        fx.process(&mut l, &mut r, &settings);
        let peak = l[100..].iter().fold(0.0f32, |m, s| m.max(s.abs()));
        assert!(peak < 0.1, "{peak}");
    }
}
