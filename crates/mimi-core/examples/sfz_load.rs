//! Decodes an `.sfz` the way the app does and reports time and memory:
//! `cargo run --release -p mimi-core --example sfz_load -- "path/to/piano.sfz"`.

use std::path::Path;
use std::time::Instant;

use mimi_core::sampler::{load_sfz, LoadOptions};

fn main() {
    let path = std::env::args().nth(1).expect("usage: sfz_load <file.sfz>");
    let started = Instant::now();
    let bank = load_sfz(Path::new(&path), LoadOptions::default()).expect("loadable .sfz");
    println!(
        "{} regions, {:.1} MB, {:.2} s",
        bank.regions.len(),
        bank.memory_bytes() as f64 / 1e6,
        started.elapsed().as_secs_f64()
    );
}
