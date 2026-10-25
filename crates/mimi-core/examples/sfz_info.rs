//! Prints what the app would load from an `.sfz` file without decoding audio:
//! `cargo run -p mimi-core --example sfz_info -- "path/to/piano.sfz"`.

use std::path::Path;

use mimi_core::sfz::{self, Trigger};

fn main() {
    let path = std::env::args().nth(1).expect("usage: sfz_info <file.sfz>");
    let path = Path::new(&path);
    let root = path.parent().unwrap_or(Path::new("."));
    let text = std::fs::read_to_string(path).expect("readable .sfz");
    let mut include =
        |name: &str| std::fs::read_to_string(root.join(name)).map_err(|e| format!("{name}: {e}"));
    let all = sfz::parse(&text, &mut include).expect("valid .sfz");
    let kept = sfz::thin_velocity_layers(all.clone(), 8);
    let count = |list: &[sfz::Region], t: Trigger| list.iter().filter(|r| r.trigger == t).count();
    println!(
        "regions: {} attack, {} release",
        count(&all, Trigger::Attack),
        count(&all, Trigger::Release)
    );
    println!(
        "after thinning: {} attack, {} release",
        count(&kept, Trigger::Attack),
        count(&kept, Trigger::Release)
    );
    for r in kept.iter().filter(|r| r.lokey <= 60 && 60 <= r.hikey) {
        println!("  {r:?}");
    }
}
