//! A sampled piano that plays SFZ instruments (spec §6.2), such as the freely
//! licensed Salamander Grand Piano that the user downloads themselves.
//!
//! Loading decodes every sample up front on the calling thread (and helper
//! threads), so playback only reads memory. After `SamplerPiano::new` nothing
//! here allocates, locks or does I/O, which keeps it safe for the real-time
//! audio callback (spec §7.3).

use std::fs::File;
use std::io::BufReader;
use std::path::Path;
use std::sync::Arc;
use std::thread;

use crate::sfz::{self, Region, Trigger};
use crate::synth::Instrument;

/// Limits that keep a large library such as Salamander (16 velocity layers of
/// 24-bit stereo FLAC, several GB once decoded) to a few hundred MB.
#[derive(Debug, Clone, Copy)]
pub struct LoadOptions {
    pub max_velocity_layers: usize,
    /// Longer samples are cut and faded out; a held piano note is almost
    /// silent by then.
    pub max_seconds: f32,
}

impl Default for LoadOptions {
    fn default() -> Self {
        Self {
            max_velocity_layers: 8,
            max_seconds: 10.0,
        }
    }
}

/// Decoded audio: interleaved stereo 16-bit, at the file's own rate.
#[derive(Debug, Clone)]
pub struct Sample {
    pub frames: Vec<[i16; 2]>,
    pub sample_rate: u32,
}

#[derive(Debug, Clone)]
pub struct SampleBank {
    pub regions: Vec<Region>,
    /// `samples[i]` is the audio of `regions[i]`; regions that share a file
    /// share the `Arc`.
    pub samples: Vec<Arc<Sample>>,
}

impl SampleBank {
    pub fn new(regions: Vec<Region>, samples: Vec<Arc<Sample>>) -> Result<Self, String> {
        if regions.len() != samples.len() {
            return Err("every region needs a sample".into());
        }
        if !regions.iter().any(|r| r.trigger == Trigger::Attack) {
            return Err("the instrument has no playable notes".into());
        }
        Ok(Self { regions, samples })
    }

    /// Memory held by the decoded audio, for the status shown to the user.
    pub fn memory_bytes(&self) -> usize {
        let mut seen: Vec<*const Sample> = Vec::new();
        let mut total = 0;
        for s in &self.samples {
            let p = Arc::as_ptr(s);
            if !seen.contains(&p) {
                seen.push(p);
                total += s.frames.len() * std::mem::size_of::<[i16; 2]>();
            }
        }
        total
    }
}

/// Reads an `.sfz` file and decodes its FLAC or WAV samples. Slow for big
/// libraries (seconds), so never call it on the audio thread.
pub fn load_sfz(path: &Path, options: LoadOptions) -> Result<SampleBank, String> {
    let root = path.parent().unwrap_or(Path::new("."));
    let text = std::fs::read_to_string(path).map_err(|e| format!("{}: {e}", path.display()))?;
    let mut include =
        |name: &str| std::fs::read_to_string(root.join(name)).map_err(|e| format!("{name}: {e}"));
    let regions = sfz::parse(&text, &mut include)?;
    let regions = sfz::thin_velocity_layers(regions, options.max_velocity_layers);

    let mut files: Vec<&str> = regions.iter().map(|r| r.sample.as_str()).collect();
    files.sort_unstable();
    files.dedup();
    let decoded = decode_all(root, &files, options.max_seconds)?;
    let samples = regions
        .iter()
        .map(|r| {
            let i = files
                .binary_search(&r.sample.as_str())
                .expect("listed above");
            decoded[i].clone()
        })
        .collect();
    SampleBank::new(regions, samples)
}

fn decode_all(root: &Path, files: &[&str], max_seconds: f32) -> Result<Vec<Arc<Sample>>, String> {
    let workers = thread::available_parallelism()
        .map_or(2, |n| n.get())
        .clamp(1, 8);
    let chunk = files.len().div_ceil(workers).max(1);
    thread::scope(|scope| {
        let handles: Vec<_> = files
            .chunks(chunk)
            .map(|part| {
                scope.spawn(move || {
                    part.iter()
                        .map(|name| {
                            decode(&root.join(name), max_seconds)
                                .map(Arc::new)
                                .map_err(|e| format!("{name}: {e}"))
                        })
                        .collect::<Result<Vec<_>, String>>()
                })
            })
            .collect();
        let mut all = Vec::with_capacity(files.len());
        for h in handles {
            all.extend(
                h.join()
                    .map_err(|_| "a sample decoder crashed".to_string())??,
            );
        }
        Ok(all)
    })
}

fn decode(path: &Path, max_seconds: f32) -> Result<Sample, String> {
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();
    let mut sample = match ext.as_str() {
        "flac" => decode_flac(path, max_seconds)?,
        "wav" => decode_wav(path, max_seconds)?,
        other => {
            return Err(format!(
                "unsupported sample format .{other} (use FLAC or WAV)"
            ))
        }
    };
    fade_out(&mut sample.frames, sample.sample_rate);
    Ok(sample)
}

fn max_frames(rate: u32, max_seconds: f32) -> usize {
    (rate as f32 * max_seconds.max(0.1)) as usize
}

fn to_i16(value: i32, bits: u32) -> i16 {
    let v = if bits > 16 {
        value >> (bits - 16)
    } else {
        value << (16 - bits.max(1))
    };
    v.clamp(i32::from(i16::MIN), i32::from(i16::MAX)) as i16
}

fn decode_flac(path: &Path, max_seconds: f32) -> Result<Sample, String> {
    let mut reader = claxon::FlacReader::open(path).map_err(|e| e.to_string())?;
    let info = reader.streaminfo();
    let limit = max_frames(info.sample_rate, max_seconds);
    let mut frames = Vec::with_capacity(info.samples.map_or(limit, |n| (n as usize).min(limit)));
    let mut blocks = reader.blocks();
    let mut buffer = Vec::new();
    while frames.len() < limit {
        let block = match blocks.read_next_or_eof(buffer) {
            Ok(Some(block)) => block,
            Ok(None) => break,
            Err(e) => return Err(e.to_string()),
        };
        let left = block.channel(0);
        let right = if block.channels() > 1 {
            block.channel(1)
        } else {
            left
        };
        for (&l, &r) in left.iter().zip(right) {
            if frames.len() == limit {
                break;
            }
            frames.push([
                to_i16(l, info.bits_per_sample),
                to_i16(r, info.bits_per_sample),
            ]);
        }
        buffer = block.into_buffer();
    }
    Ok(Sample {
        frames,
        sample_rate: info.sample_rate,
    })
}

fn decode_wav(path: &Path, max_seconds: f32) -> Result<Sample, String> {
    let reader =
        hound::WavReader::new(BufReader::new(File::open(path).map_err(|e| e.to_string())?))
            .map_err(|e| e.to_string())?;
    let spec = reader.spec();
    let channels = usize::from(spec.channels.max(1));
    let limit = max_frames(spec.sample_rate, max_seconds);
    let values: Vec<i16> = match spec.sample_format {
        hound::SampleFormat::Int => reader
            .into_samples::<i32>()
            .take(limit * channels)
            .map(|s| s.map(|v| to_i16(v, u32::from(spec.bits_per_sample))))
            .collect::<Result<_, _>>(),
        hound::SampleFormat::Float => reader
            .into_samples::<f32>()
            .take(limit * channels)
            .map(|s| s.map(|v| (v.clamp(-1.0, 1.0) * f32::from(i16::MAX)) as i16))
            .collect::<Result<_, _>>(),
    }
    .map_err(|e| e.to_string())?;
    let frames = values
        .chunks_exact(channels)
        .map(|f| [f[0], f[if channels > 1 { 1 } else { 0 }]])
        .collect();
    Ok(Sample {
        frames,
        sample_rate: spec.sample_rate,
    })
}

/// Fades the last half second (or quarter of a short sample) to silence, so
/// a cut-off sample ends without a click.
fn fade_out(frames: &mut [[i16; 2]], rate: u32) {
    let len = (rate as usize / 2)
        .min(frames.len() / 4)
        .max(1)
        .min(frames.len());
    let start = frames.len() - len;
    for (i, f) in frames[start..].iter_mut().enumerate() {
        let g = 1.0 - (i + 1) as f32 / len as f32;
        for s in f.iter_mut() {
            *s = (f32::from(*s) * g) as i16;
        }
    }
}

const MAX_VOICES: usize = 64;
/// Leaves headroom for chords before the master gain; samples are recorded
/// close to full scale.
const LEVEL: f32 = 0.45;
/// -60 dB.
const SILENT: f32 = 1e-3;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum State {
    Idle,
    /// Key (or pedal) held: the sample plays with its natural decay.
    Held,
    Releasing,
    /// Cut short because the same key was struck again.
    Choked,
}

#[derive(Debug, Clone, Copy)]
struct Voice {
    state: State,
    key: u8,
    region: usize,
    trigger: Trigger,
    group: i64,
    pos: f64,
    step: f64,
    gain: f32,
    env: f32,
    fade: f32,
}

impl Voice {
    const IDLE: Self = Self {
        state: State::Idle,
        key: 0,
        region: 0,
        trigger: Trigger::Attack,
        group: 0,
        pos: 0.0,
        step: 0.0,
        gain: 0.0,
        env: 0.0,
        fade: 1.0,
    };
}

#[derive(Debug, Clone, Copy)]
struct Key {
    down: bool,
    /// Released while the pedal was down; ends when the pedal comes up.
    sustained: bool,
    velocity: u8,
    pressed_at: u64,
}

pub struct SamplerPiano {
    bank: Arc<SampleBank>,
    voices: Box<[Voice; MAX_VOICES]>,
    keys: [Key; 128],
    sustain: bool,
    rate: f32,
    clock: u64,
}

impl SamplerPiano {
    pub fn new(bank: &Arc<SampleBank>, sample_rate: u32) -> Self {
        Self {
            bank: bank.clone(),
            voices: Box::new([Voice::IDLE; MAX_VOICES]),
            keys: [Key {
                down: false,
                sustained: false,
                velocity: 0,
                pressed_at: 0,
            }; 128],
            sustain: false,
            rate: sample_rate.max(1) as f32,
            clock: 0,
        }
    }

    pub fn active_voices(&self) -> usize {
        self.voices
            .iter()
            .filter(|v| v.state != State::Idle)
            .count()
    }

    /// Per-sample multiplier that reaches -60 dB after `seconds`.
    fn coefficient(&self, seconds: f32) -> f32 {
        (SILENT.ln() / (seconds.max(0.001) * self.rate)).exp()
    }

    fn start(&mut self, region_index: usize, key: u8, velocity: u8, extra_db: f32) {
        let region = &self.bank.regions[region_index];
        let sample = &self.bank.samples[region_index];
        // Same key and same kind of sound: the new strike replaces the old one.
        let off = self.coefficient(region.off_seconds);
        for v in self.voices.iter_mut() {
            if v.state != State::Idle
                && v.key == key
                && v.trigger == region.trigger
                && v.group == region.group
            {
                v.state = State::Choked;
                v.fade = off;
            }
        }
        let cents =
            region.tune_cents + (f32::from(key) - f32::from(region.keycenter)) * region.keytrack;
        let step = 2f64.powf(f64::from(cents) / 1200.0) * f64::from(sample.sample_rate)
            / f64::from(self.rate);
        let curve = (f32::from(velocity) / 127.0).powi(2);
        let velocity_gain = 1.0 - region.veltrack * (1.0 - curve);
        let gain = 10f32.powf((region.volume_db + extra_db) / 20.0)
            * region.amplitude
            * velocity_gain.max(0.0)
            * LEVEL;
        let voice = Voice {
            state: State::Held,
            key,
            region: region_index,
            trigger: region.trigger,
            group: region.group,
            pos: 0.0,
            step,
            gain,
            env: 1.0,
            fade: self.coefficient(region.release_seconds),
        };
        let index = self
            .voices
            .iter()
            .position(|v| v.state == State::Idle)
            .unwrap_or_else(|| {
                (0..MAX_VOICES)
                    .min_by(|&a, &b| {
                        let loud = |v: &Voice| v.env * v.gain;
                        loud(&self.voices[a]).total_cmp(&loud(&self.voices[b]))
                    })
                    .unwrap_or(0)
            });
        self.voices[index] = voice;
    }

    /// Ends a note: its voices fade with their release time and the
    /// release-triggered regions (hammer and string noise) start.
    fn end(&mut self, key: u8) {
        let state = self.keys[usize::from(key)];
        for v in self.voices.iter_mut() {
            if v.key == key && v.state == State::Held && v.trigger == Trigger::Attack {
                v.state = State::Releasing;
            }
        }
        let held = self.clock.saturating_sub(state.pressed_at) as f32 / self.rate;
        for i in 0..self.bank.regions.len() {
            let r = &self.bank.regions[i];
            if r.matches(key, state.velocity, Trigger::Release) {
                let db = -r.rt_decay_db * held;
                if db > -60.0 {
                    self.start(i, key, state.velocity, db);
                }
            }
        }
    }
}

impl Instrument for SamplerPiano {
    fn note_on(&mut self, pitch: u8, velocity: u8) {
        let Some(slot) = self.keys.get_mut(usize::from(pitch)) else {
            return;
        };
        let velocity = velocity.clamp(1, 127);
        *slot = Key {
            down: true,
            sustained: false,
            velocity,
            pressed_at: self.clock,
        };
        for i in 0..self.bank.regions.len() {
            if self.bank.regions[i].matches(pitch, velocity, Trigger::Attack) {
                self.start(i, pitch, velocity, 0.0);
            }
        }
    }

    fn note_off(&mut self, pitch: u8) {
        let Some(slot) = self.keys.get_mut(usize::from(pitch)) else {
            return;
        };
        if !slot.down {
            return;
        }
        slot.down = false;
        if self.sustain {
            slot.sustained = true;
        } else {
            self.end(pitch);
        }
    }

    fn set_sustain(&mut self, on: bool) {
        self.sustain = on;
        if !on {
            for key in 0..128u8 {
                if std::mem::take(&mut self.keys[usize::from(key)].sustained) {
                    self.end(key);
                }
            }
        }
    }

    fn all_notes_off(&mut self) {
        self.sustain = false;
        for k in self.keys.iter_mut() {
            k.down = false;
            k.sustained = false;
        }
        for v in self.voices.iter_mut() {
            if v.state == State::Held {
                v.state = State::Releasing;
            }
        }
    }

    fn render(&mut self, left: &mut [f32], right: &mut [f32]) {
        left.fill(0.0);
        right.fill(0.0);
        let bank = &self.bank;
        for v in self.voices.iter_mut() {
            if v.state == State::Idle {
                continue;
            }
            let frames = &bank.samples[v.region].frames;
            for (l, r) in left.iter_mut().zip(right.iter_mut()) {
                let i = v.pos as usize;
                if i + 1 >= frames.len() {
                    *v = Voice::IDLE;
                    break;
                }
                if v.state != State::Held {
                    v.env *= v.fade;
                    if v.env < SILENT {
                        *v = Voice::IDLE;
                        break;
                    }
                }
                let t = (v.pos - i as f64) as f32;
                let (a, b) = (frames[i], frames[i + 1]);
                let g = v.gain * v.env / 32768.0;
                *l += (f32::from(a[0]) + (f32::from(b[0]) - f32::from(a[0])) * t) * g;
                *r += (f32::from(a[1]) + (f32::from(b[1]) - f32::from(a[1])) * t) * g;
                v.pos += v.step;
            }
        }
        self.clock += left.len() as u64;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SR: u32 = 48_000;

    fn region(
        sample: &str,
        lokey: u8,
        hikey: u8,
        lovel: u8,
        hivel: u8,
        trigger: Trigger,
    ) -> Region {
        Region {
            sample: sample.into(),
            lokey,
            hikey,
            keycenter: lokey,
            lovel,
            hivel,
            trigger,
            tune_cents: 0.0,
            keytrack: 100.0,
            volume_db: 0.0,
            amplitude: 1.0,
            veltrack: 1.0,
            release_seconds: 0.2,
            rt_decay_db: 0.0,
            off_seconds: 0.05,
            group: if trigger == Trigger::Release { 1 } else { 0 },
        }
    }

    /// A constant tone so pitch can be read from zero crossings.
    fn sine(freq: f32, seconds: f32) -> Arc<Sample> {
        let n = (SR as f32 * seconds) as usize;
        Arc::new(Sample {
            frames: (0..n)
                .map(|i| {
                    let s = ((i as f32 / SR as f32) * freq * std::f32::consts::TAU).sin();
                    let v = (s * 20_000.0) as i16;
                    [v, v]
                })
                .collect(),
            sample_rate: SR,
        })
    }

    fn bank(with_release: bool) -> Arc<SampleBank> {
        let soft = sine(220.0, 4.0);
        let loud = sine(220.0, 4.0);
        let mut regions = vec![
            region("soft", 57, 59, 0, 63, Trigger::Attack),
            region("loud", 57, 59, 64, 127, Trigger::Attack),
        ];
        let mut samples = vec![soft, loud];
        if with_release {
            regions.push(region("hammer", 57, 59, 0, 127, Trigger::Release));
            samples.push(sine(1000.0, 0.3));
        }
        Arc::new(SampleBank::new(regions, samples).unwrap())
    }

    fn render(piano: &mut SamplerPiano, frames: usize) -> (Vec<f32>, Vec<f32>) {
        let mut l = vec![0.0; frames];
        let mut r = vec![0.0; frames];
        piano.render(&mut l, &mut r);
        (l, r)
    }

    fn rms(s: &[f32]) -> f32 {
        (s.iter().map(|x| x * x).sum::<f32>() / s.len() as f32).sqrt()
    }

    fn crossings(s: &[f32]) -> usize {
        s.windows(2).filter(|w| w[0] < 0.0 && w[1] >= 0.0).count()
    }

    #[test]
    fn silent_until_a_note_plays_and_ignores_keys_outside_every_region() {
        let mut piano = SamplerPiano::new(&bank(false), SR);
        assert_eq!(rms(&render(&mut piano, 512).0), 0.0);
        piano.note_on(80, 100);
        assert_eq!(piano.active_voices(), 0);
        piano.note_on(57, 100);
        assert!(rms(&render(&mut piano, 512).0) > 0.01);
    }

    #[test]
    fn velocity_picks_the_layer_and_loudness() {
        let b = bank(false);
        let mut soft = SamplerPiano::new(&b, SR);
        let mut loud = SamplerPiano::new(&b, SR);
        soft.note_on(57, 20);
        loud.note_on(57, 120);
        assert_eq!(soft.voices[0].region, 0);
        assert_eq!(loud.voices[0].region, 1);
        assert!(rms(&render(&mut loud, 2048).0) > rms(&render(&mut soft, 2048).0));
    }

    #[test]
    fn keys_above_the_center_are_pitched_up() {
        let mut piano = SamplerPiano::new(&bank(false), SR);
        piano.note_on(57, 100);
        let base = crossings(&render(&mut piano, SR as usize).0) as f32;
        let mut up = SamplerPiano::new(&bank(false), SR);
        up.note_on(59, 100); // two semitones
        let raised = crossings(&render(&mut up, SR as usize).0) as f32;
        assert!((base - 220.0).abs() <= 2.0, "{base}");
        assert!(
            (raised / base - 2f32.powf(2.0 / 12.0)).abs() < 0.01,
            "{raised}"
        );
    }

    #[test]
    fn output_rate_differs_from_the_sample_rate() {
        let mut piano = SamplerPiano::new(&bank(false), 44_100);
        piano.note_on(57, 100);
        let hz = crossings(&render(&mut piano, 44_100).0) as f32;
        assert!((hz - 220.0).abs() <= 2.0, "{hz}");
    }

    #[test]
    fn release_fades_and_frees_the_voice() {
        let mut piano = SamplerPiano::new(&bank(false), SR);
        piano.note_on(58, 100);
        render(&mut piano, 4800);
        piano.note_off(58);
        render(&mut piano, SR as usize / 2);
        assert_eq!(piano.active_voices(), 0);
    }

    #[test]
    fn sustain_keeps_ringing_until_pedal_up_then_plays_release_noise() {
        let mut piano = SamplerPiano::new(&bank(true), SR);
        piano.set_sustain(true);
        piano.note_on(58, 100);
        piano.note_off(58);
        render(&mut piano, SR as usize / 2);
        assert_eq!(
            piano.active_voices(),
            1,
            "pedal holds the note, no release noise yet"
        );
        piano.set_sustain(false);
        assert_eq!(
            piano.active_voices(),
            2,
            "release region starts on pedal up"
        );
        render(&mut piano, SR as usize);
        assert_eq!(piano.active_voices(), 0);
    }

    #[test]
    fn restriking_a_key_replaces_the_old_voice() {
        let mut piano = SamplerPiano::new(&bank(false), SR);
        piano.set_sustain(true);
        piano.note_on(58, 100);
        piano.note_off(58);
        piano.note_on(58, 100);
        render(&mut piano, SR as usize / 4);
        assert_eq!(piano.active_voices(), 1);
    }

    #[test]
    fn more_notes_than_voices_steals_instead_of_failing() {
        let mut piano = SamplerPiano::new(&bank(false), SR);
        piano.set_sustain(true);
        for _ in 0..(MAX_VOICES + 10) {
            for key in 57..=59 {
                piano.note_on(key, 100);
                piano.note_off(key);
            }
            // Restrikes choke, so give them time to finish fading.
            render(&mut piano, 64);
        }
        assert!(piano.active_voices() <= MAX_VOICES);
        assert!(render(&mut piano, 256).0.iter().all(|s| s.is_finite()));
    }

    #[test]
    fn all_notes_off_releases_even_with_pedal_down() {
        let mut piano = SamplerPiano::new(&bank(true), SR);
        piano.set_sustain(true);
        piano.note_on(57, 100);
        piano.note_on(59, 30);
        piano.all_notes_off();
        render(&mut piano, SR as usize);
        assert_eq!(piano.active_voices(), 0);
    }

    #[test]
    fn decodes_wav_and_cuts_long_samples() {
        let dir = std::env::temp_dir().join(format!("mimi-sfz-{}", std::process::id()));
        std::fs::create_dir_all(dir.join("s")).unwrap();
        let spec = hound::WavSpec {
            channels: 1,
            sample_rate: 8_000,
            bits_per_sample: 24,
            sample_format: hound::SampleFormat::Int,
        };
        let mut w = hound::WavWriter::create(dir.join("s/c4.wav"), spec).unwrap();
        for i in 0..24_000 {
            w.write_sample(if i % 2 == 0 { 4_000_000 } else { -4_000_000 })
                .unwrap();
        }
        w.finalize().unwrap();
        std::fs::write(
            dir.join("piano.sfz"),
            "<control> default_path=s/\n<region> lokey=0 hikey=127 pitch_keycenter=60 sample=c4.wav",
        )
        .unwrap();
        let bank = load_sfz(
            &dir.join("piano.sfz"),
            LoadOptions {
                max_velocity_layers: 8,
                max_seconds: 2.0,
            },
        )
        .unwrap();
        let s = &bank.samples[0];
        assert_eq!(s.frames.len(), 16_000, "3 s cut to 2 s");
        assert_eq!(
            s.frames[0],
            [15_625, 15_625],
            "24-bit mono to 16-bit stereo"
        );
        assert_eq!(s.frames.last().unwrap()[0], 0, "faded out");
        assert_eq!(bank.memory_bytes(), 16_000 * 4);

        let missing = dir.join("missing.sfz");
        std::fs::write(&missing, "<region> key=60 sample=nope.flac").unwrap();
        assert!(load_sfz(&missing, LoadOptions::default())
            .unwrap_err()
            .contains("nope.flac"));
        std::fs::remove_dir_all(dir).ok();
    }
}
