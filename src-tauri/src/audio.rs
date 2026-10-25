//! Audio output (spec §6.2, §7.3–7.4).
//!
//! A dedicated thread owns the cpal stream, because streams are not `Send` on
//! every platform. Note events reach the audio callback through a lock-free
//! ring buffer and gains are atomics, so the callback never locks, allocates
//! or does I/O. Changing device or SoundFont rebuilds the stream on that
//! thread; the old stream is dropped first so the device is released.

use std::sync::{mpsc, Arc, Mutex};
use std::thread;

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, SampleFormat, SizedSample};
use mimi_core::audio::{AudioCommand, Gains, Renderer};
use mimi_core::synth::{BasicPiano, Instrument, SoundFont, SoundFontPiano};
use serde::Serialize;

/// Note events queued between callbacks; at 48 kHz a callback runs every few
/// milliseconds, far faster than anyone can play 1024 events.
const QUEUE: usize = 1024;
/// Interleaved samples rendered per pass inside the callback.
const SCRATCH: usize = 16_384;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioStatus {
    pub device: Option<String>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u16>,
    /// "basic" (built-in tone) or "soundfont".
    pub instrument: &'static str,
    pub sound_font: Option<String>,
    pub error: Option<String>,
}

impl AudioStatus {
    fn empty() -> Self {
        Self {
            device: None,
            sample_rate: None,
            channels: None,
            instrument: "basic",
            sound_font: None,
            error: None,
        }
    }

    fn with_error(mut self, error: impl Into<String>) -> Self {
        self.error = Some(error.into());
        self
    }
}

type Reply = mpsc::Sender<AudioStatus>;

enum Control {
    Open(Option<String>, Reply),
    SoundFont(Arc<SoundFont>, String, Reply),
}

pub struct AudioEngine {
    control: Mutex<mpsc::Sender<Control>>,
    queue: Arc<Mutex<Option<rtrb::Producer<AudioCommand>>>>,
    pub gains: Arc<Gains>,
    status: Arc<Mutex<AudioStatus>>,
}

impl AudioEngine {
    pub fn start() -> Self {
        let (tx, rx) = mpsc::channel();
        let engine = Self {
            control: Mutex::new(tx),
            queue: Arc::new(Mutex::new(None)),
            gains: Arc::new(Gains::default()),
            status: Arc::new(Mutex::new(AudioStatus::empty())),
        };
        let (queue, gains, status) = (
            engine.queue.clone(),
            engine.gains.clone(),
            engine.status.clone(),
        );
        thread::Builder::new()
            .name("audio-control".into())
            .spawn(move || run(rx, queue, gains, status))
            .expect("failed to start the audio control thread");
        engine
    }

    /// Queues a note event for the audio callback. If no stream is open, or
    /// the queue is full, the event is dropped rather than blocking the caller.
    pub fn send(&self, command: AudioCommand) {
        if let Some(producer) = self.queue.lock().unwrap().as_mut() {
            let _ = producer.push(command);
        }
    }

    /// Opens the named output device, or the system default for `None`.
    pub fn open(&self, device: Option<String>) -> AudioStatus {
        self.request(|reply| Control::Open(device, reply))
    }

    pub fn set_sound_font(&self, sound_font: Arc<SoundFont>, name: String) -> AudioStatus {
        self.request(|reply| Control::SoundFont(sound_font, name, reply))
    }

    pub fn status(&self) -> AudioStatus {
        self.status.lock().unwrap().clone()
    }

    fn request(&self, make: impl FnOnce(Reply) -> Control) -> AudioStatus {
        let (reply, answer) = mpsc::channel();
        if self.control.lock().unwrap().send(make(reply)).is_err() {
            return AudioStatus::empty().with_error("audio thread stopped");
        }
        answer
            .recv()
            .unwrap_or_else(|_| AudioStatus::empty().with_error("audio thread stopped"))
    }
}

pub fn output_device_names() -> Vec<String> {
    match cpal::default_host().output_devices() {
        Ok(devices) => devices
            .filter_map(|d| d.description().ok().map(|desc| desc.name().to_string()))
            .collect(),
        Err(_) => Vec::new(),
    }
}

fn run(
    rx: mpsc::Receiver<Control>,
    queue: Arc<Mutex<Option<rtrb::Producer<AudioCommand>>>>,
    gains: Arc<Gains>,
    status: Arc<Mutex<AudioStatus>>,
) {
    let mut stream: Option<cpal::Stream> = None;
    let mut device: Option<String> = None;
    let mut sound_font: Option<(Arc<SoundFont>, String)> = None;
    while let Ok(control) = rx.recv() {
        let reply = match control {
            Control::Open(name, reply) => {
                device = name;
                reply
            }
            Control::SoundFont(font, name, reply) => {
                sound_font = Some((font, name));
                reply
            }
        };
        *queue.lock().unwrap() = None;
        drop(stream.take());
        let result = open_stream(device.as_deref(), sound_font.as_ref(), &gains, &status);
        let new_status = match result {
            Ok((s, producer, st)) => {
                stream = Some(s);
                *queue.lock().unwrap() = Some(producer);
                st
            }
            Err(st) => st,
        };
        *status.lock().unwrap() = new_status.clone();
        let _ = reply.send(new_status);
    }
}

type Opened = (cpal::Stream, rtrb::Producer<AudioCommand>, AudioStatus);

fn open_stream(
    name: Option<&str>,
    sound_font: Option<&(Arc<SoundFont>, String)>,
    gains: &Arc<Gains>,
    status: &Arc<Mutex<AudioStatus>>,
) -> Result<Opened, AudioStatus> {
    let mut st = AudioStatus::empty();
    let host = cpal::default_host();
    let device = match name {
        None => host.default_output_device(),
        Some(wanted) => host.output_devices().ok().and_then(|mut devices| {
            devices.find(|d| {
                d.description()
                    .map(|desc| desc.name() == wanted)
                    .unwrap_or(false)
            })
        }),
    }
    .ok_or_else(|| st.clone().with_error("audio output device not found"))?;
    st.device = device.description().ok().map(|d| d.name().to_string());

    let supported = device
        .default_output_config()
        .map_err(|e| st.clone().with_error(e.to_string()))?;
    let config = supported.config();
    st.sample_rate = Some(config.sample_rate);
    st.channels = Some(config.channels);

    let instrument: Box<dyn Instrument> = match sound_font {
        Some((font, font_name)) => match SoundFontPiano::new(font, config.sample_rate) {
            Ok(piano) => {
                st.instrument = "soundfont";
                st.sound_font = Some(font_name.clone());
                Box::new(piano)
            }
            Err(e) => {
                st.error = Some(format!("SoundFont could not be used: {e}"));
                Box::new(BasicPiano::new(config.sample_rate))
            }
        },
        None => Box::new(BasicPiano::new(config.sample_rate)),
    };

    let (producer, consumer) = rtrb::RingBuffer::new(QUEUE);
    let renderer = Renderer::new(instrument);
    let stream = match supported.sample_format() {
        SampleFormat::F32 => build::<f32>(&device, config, renderer, consumer, gains, status),
        SampleFormat::I16 => build::<i16>(&device, config, renderer, consumer, gains, status),
        SampleFormat::U16 => build::<u16>(&device, config, renderer, consumer, gains, status),
        SampleFormat::I32 => build::<i32>(&device, config, renderer, consumer, gains, status),
        other => Err(format!("unsupported sample format {other:?}")),
    }
    .map_err(|e| st.clone().with_error(e))?;
    stream
        .play()
        .map_err(|e| st.clone().with_error(e.to_string()))?;
    Ok((stream, producer, st))
}

fn build<T>(
    device: &cpal::Device,
    config: cpal::StreamConfig,
    mut renderer: Renderer,
    mut consumer: rtrb::Consumer<AudioCommand>,
    gains: &Arc<Gains>,
    status: &Arc<Mutex<AudioStatus>>,
) -> Result<cpal::Stream, String>
where
    T: SizedSample + FromSample<f32>,
{
    let channels = usize::from(config.channels).max(1);
    // Allocated here, once; the callback only reuses it.
    let mut scratch = vec![0.0f32; SCRATCH / channels * channels];
    let gains = gains.clone();
    let status = status.clone();
    device
        .build_output_stream::<T, _, _>(
            config,
            move |out: &mut [T], _| {
                while let Ok(command) = consumer.pop() {
                    renderer.apply(command);
                }
                for chunk in out.chunks_mut(scratch.len()) {
                    let buf = &mut scratch[..chunk.len()];
                    renderer.render_interleaved(buf, channels, &gains);
                    for (o, s) in chunk.iter_mut().zip(buf.iter()) {
                        *o = T::from_sample(*s);
                    }
                }
            },
            move |err| {
                if let Ok(mut s) = status.lock() {
                    s.error = Some(err.to_string());
                }
            },
            None,
        )
        .map_err(|e| e.to_string())
}
