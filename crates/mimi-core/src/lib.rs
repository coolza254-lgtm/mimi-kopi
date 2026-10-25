//! Core logic for Mimi Kopi that does not depend on Tauri, the OS MIDI API or
//! an audio device, so it can be unit tested on any platform.

pub mod audio;
pub mod capability;
pub mod midi;
pub mod sampler;
pub mod sfz;
pub mod synth;
pub mod tone;
