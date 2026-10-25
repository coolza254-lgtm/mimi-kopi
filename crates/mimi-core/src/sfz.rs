//! A parser for the subset of the SFZ format that sampled pianos use, such as
//! the freely licensed Salamander Grand Piano (spec §6.2).
//!
//! It understands `#define`, `#include` (also in the middle of a line), the
//! `<control>`, `<global>`, `<master>`, `<group>` and `<region>` headers and
//! their inheritance, and the opcodes a piano needs. Anything a practice app
//! cannot honour, such as regions started by a CC or a random round robin
//! beyond the first, is left out rather than played wrongly. MIDI CCs keep
//! the defaults the file sets in `<control>`, because the app does not send
//! CCs other than the sustain pedal.

use std::collections::HashMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Trigger {
    Attack,
    /// Plays when the note ends (key up, or pedal up for a sustained key).
    Release,
}

#[derive(Debug, Clone, PartialEq)]
pub struct Region {
    /// Path relative to the `.sfz` file, with `/` separators.
    pub sample: String,
    pub lokey: u8,
    pub hikey: u8,
    pub keycenter: u8,
    pub lovel: u8,
    pub hivel: u8,
    pub trigger: Trigger,
    /// Fine tuning plus transpose, in cents.
    pub tune_cents: f32,
    /// Cents per key away from `keycenter`.
    pub keytrack: f32,
    pub volume_db: f32,
    /// 0..=1 multiplier from `amplitude`.
    pub amplitude: f32,
    /// How much velocity changes loudness, 0..=1 (`amp_veltrack` / 100).
    pub veltrack: f32,
    pub release_seconds: f32,
    /// Release triggers only: dB lost per second the key was held.
    pub rt_decay_db: f32,
    /// Fade time when the same key is struck again.
    pub off_seconds: f32,
    pub group: i64,
}

impl Region {
    pub fn matches(&self, key: u8, velocity: u8, trigger: Trigger) -> bool {
        self.trigger == trigger
            && (self.lokey..=self.hikey).contains(&key)
            && (self.lovel..=self.hivel).contains(&velocity)
    }
}

/// Parses `text`. `include` returns the contents of a file named by
/// `#include`, relative to the main `.sfz` file.
pub fn parse(
    text: &str,
    include: &mut dyn FnMut(&str) -> Result<String, String>,
) -> Result<Vec<Region>, String> {
    let mut parser = Parser::default();
    parser.scan(text, include, 0)?;
    parser.finish_region();
    Ok(parser.finish())
}

/// Parses a note number or name such as `60`, `c4`, `C#0` or `Eb3`
/// (C4 = 60, the SFZ convention).
pub fn parse_key(value: &str) -> Option<i32> {
    let value = value.trim();
    if let Ok(n) = value.parse::<i32>() {
        return Some(n);
    }
    let mut chars = value.chars();
    let base = match chars.next()?.to_ascii_lowercase() {
        'c' => 0,
        'd' => 2,
        'e' => 4,
        'f' => 5,
        'g' => 7,
        'a' => 9,
        'b' => 11,
        _ => return None,
    };
    let rest = chars.as_str();
    let (shift, octave) = if let Some(o) = rest.strip_prefix('#') {
        (1, o)
    } else if let Some(o) = rest.strip_prefix('b') {
        (-1, o)
    } else {
        (0, rest)
    };
    let octave: i32 = octave.parse().ok()?;
    Some((octave + 1) * 12 + base + shift)
}

const MAX_INCLUDE_DEPTH: usize = 16;

type Opcodes = HashMap<String, String>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Level {
    None,
    Control,
    Global,
    Master,
    Group,
    Region,
    /// `<curve>`, `<effect>` and others the app does not use.
    Ignored,
}

#[derive(Debug)]
struct Parser {
    defines: Vec<(String, String)>,
    level: Level,
    control: Opcodes,
    global: Opcodes,
    master: Opcodes,
    group: Opcodes,
    region: Option<Opcodes>,
    /// Name of the opcode a value-continuation word belongs to.
    last_opcode: Option<String>,
    raw: Vec<Opcodes>,
}

impl Default for Parser {
    fn default() -> Self {
        Self {
            defines: Vec::new(),
            level: Level::None,
            control: Opcodes::new(),
            global: Opcodes::new(),
            master: Opcodes::new(),
            group: Opcodes::new(),
            region: None,
            last_opcode: None,
            raw: Vec::new(),
        }
    }
}

impl Parser {
    fn scan(
        &mut self,
        text: &str,
        include: &mut dyn FnMut(&str) -> Result<String, String>,
        depth: usize,
    ) -> Result<(), String> {
        let mut rest = text;
        loop {
            rest = rest.trim_start();
            if rest.is_empty() {
                return Ok(());
            }
            if let Some(r) = rest.strip_prefix("//") {
                rest = r.split_once('\n').map_or("", |(_, after)| after);
            } else if let Some(r) = rest.strip_prefix("/*") {
                rest = r.split_once("*/").map_or("", |(_, after)| after);
            } else if let Some(r) = rest.strip_prefix('<') {
                let (name, after) = r
                    .split_once('>')
                    .ok_or_else(|| "unclosed <header>".to_string())?;
                self.header(name.trim());
                rest = after;
            } else if let Some(r) = rest.strip_prefix("#define") {
                let (name, r) = word(r.trim_start());
                let (value, r) = word(r.trim_start());
                if !name.starts_with('$') {
                    return Err(format!("bad #define name: {name}"));
                }
                self.define(name, value);
                rest = r;
            } else if let Some(r) = rest.strip_prefix("#include") {
                let r = r.trim_start();
                let r = r
                    .strip_prefix('"')
                    .ok_or_else(|| "#include needs a quoted path".to_string())?;
                let (path, after) = r
                    .split_once('"')
                    .ok_or_else(|| "unclosed #include path".to_string())?;
                if depth >= MAX_INCLUDE_DEPTH {
                    return Err(format!("#include nested too deeply at {path}"));
                }
                let path = self.substitute(path);
                let contents = include(&path)?;
                self.scan(&contents, include, depth + 1)?;
                rest = after;
            } else {
                let (w, after) = word(rest);
                self.word(w);
                rest = after;
            }
        }
    }

    fn define(&mut self, name: &str, value: &str) {
        let value = self.substitute(value);
        self.defines.retain(|(n, _)| n != name);
        self.defines.push((name.to_string(), value));
        // Longest first, so $TUNE10 is not read as $TUNE1 followed by 0.
        self.defines
            .sort_by_key(|(n, _)| std::cmp::Reverse(n.len()));
    }

    fn substitute(&self, text: &str) -> String {
        if !text.contains('$') {
            return text.to_string();
        }
        let mut out = text.to_string();
        for (name, value) in &self.defines {
            out = out.replace(name.as_str(), value);
        }
        out
    }

    fn header(&mut self, name: &str) {
        self.finish_region();
        self.last_opcode = None;
        self.level = match name {
            "control" => {
                self.control.clear();
                Level::Control
            }
            "global" => {
                self.global.clear();
                self.master.clear();
                self.group.clear();
                Level::Global
            }
            "master" => {
                self.master.clear();
                self.group.clear();
                Level::Master
            }
            "group" => {
                self.group.clear();
                Level::Group
            }
            "region" => {
                self.region = Some(Opcodes::new());
                Level::Region
            }
            _ => Level::Ignored,
        };
    }

    fn word(&mut self, w: &str) {
        let w = self.substitute(w);
        let target = match self.level {
            Level::Control => &mut self.control,
            Level::Global => &mut self.global,
            Level::Master => &mut self.master,
            Level::Group => &mut self.group,
            Level::Region => match self.region.as_mut() {
                Some(r) => r,
                None => return,
            },
            Level::None | Level::Ignored => return,
        };
        match w.split_once('=') {
            Some((name, value)) => {
                target.insert(name.to_string(), value.to_string());
                self.last_opcode = Some(name.to_string());
            }
            // Values such as sample paths may contain spaces.
            None => {
                if let Some(value) = self.last_opcode.as_ref().and_then(|n| target.get_mut(n)) {
                    value.push(' ');
                    value.push_str(&w);
                }
            }
        }
    }

    fn finish_region(&mut self) {
        if let Some(own) = self.region.take() {
            let mut merged = self.global.clone();
            merged.extend(self.master.clone());
            merged.extend(self.group.clone());
            merged.extend(own);
            self.raw.push(merged);
        }
    }

    fn finish(self) -> Vec<Region> {
        let cc = cc_defaults(&self.control);
        let default_path = self
            .control
            .get("default_path")
            .map(|p| p.replace('\\', "/"))
            .unwrap_or_default();
        self.raw
            .iter()
            .filter_map(|ops| region(ops, &cc, &default_path))
            .collect()
    }
}

/// Splits off the next whitespace-delimited word, also stopping at `<` so a
/// header written right after a value starts a new token.
fn word(text: &str) -> (&str, &str) {
    let end = text
        .char_indices()
        .skip(1)
        .find(|&(_, c)| c.is_whitespace() || c == '<')
        .map_or(text.len(), |(i, _)| i);
    text.split_at(end)
}

/// CC values (0..=1) set by `set_ccN` (0..=127) and `set_hdccN` (0..=1).
fn cc_defaults(control: &Opcodes) -> HashMap<u32, f32> {
    let mut cc = HashMap::new();
    for (name, value) in control {
        let Ok(v) = value.trim().parse::<f32>() else {
            continue;
        };
        if let Some(n) = name.strip_prefix("set_hdcc").and_then(|n| n.parse().ok()) {
            cc.insert(n, v.clamp(0.0, 1.0));
        } else if let Some(n) = name.strip_prefix("set_cc").and_then(|n| n.parse().ok()) {
            cc.insert(n, (v / 127.0).clamp(0.0, 1.0));
        }
    }
    cc
}

fn number(ops: &Opcodes, name: &str) -> Option<f32> {
    ops.get(name).and_then(|v| v.trim().parse().ok())
}

fn key(ops: &Opcodes, name: &str) -> Option<i32> {
    ops.get(name).and_then(|v| parse_key(v))
}

/// The base value of `name` plus every `name_onccN` scaled by that CC's default.
fn modulated(ops: &Opcodes, name: &str, base: f32, cc: &HashMap<u32, f32>) -> f32 {
    let prefix = format!("{name}_oncc");
    let mut value = number(ops, name).unwrap_or(base);
    for (op, depth) in ops {
        let Some(n) = op.strip_prefix(&prefix).and_then(|n| n.parse::<u32>().ok()) else {
            continue;
        };
        if let Ok(depth) = depth.trim().parse::<f32>() {
            value += depth * cc.get(&n).copied().unwrap_or(0.0);
        }
    }
    value
}

fn region(ops: &Opcodes, cc: &HashMap<u32, f32>, default_path: &str) -> Option<Region> {
    let sample = ops.get("sample")?.trim().replace('\\', "/");
    if sample.starts_with('*') {
        return None; // generated waveforms such as *sine
    }
    // Started by a CC (pedal noises) rather than by a key.
    if ops
        .keys()
        .any(|k| k.starts_with("on_locc") || k.starts_with("on_hicc"))
    {
        return None;
    }
    // Only the default keyswitch articulation.
    if let (Some(last), Some(default)) = (key(ops, "sw_last"), key(ops, "sw_default")) {
        if last != default {
            return None;
        }
    }
    // CC conditions are judged against the defaults from <control>.
    for (op, value) in ops {
        let (low, n) = if let Some(n) = op.strip_prefix("locc") {
            (true, n)
        } else if let Some(n) = op.strip_prefix("hicc") {
            (false, n)
        } else {
            continue;
        };
        let (Ok(n), Ok(limit)) = (n.parse::<u32>(), value.trim().parse::<f32>()) else {
            continue;
        };
        let current = cc.get(&n).copied().unwrap_or(0.0) * 127.0;
        if (low && current < limit) || (!low && current > limit) {
            return None;
        }
    }
    // Round robin: keep only the first random variant.
    if number(ops, "lorand").is_some_and(|r| r > 0.0) {
        return None;
    }

    let (lokey, hikey, center) = match key(ops, "key") {
        Some(k) => (k, k, k),
        None => {
            let lo = key(ops, "lokey").unwrap_or(0);
            let hi = key(ops, "hikey").unwrap_or(127);
            (lo, hi, key(ops, "pitch_keycenter").unwrap_or(60))
        }
    };
    let midi = |k: i32| u8::try_from(k).ok().filter(|k| *k <= 127);
    let (lokey, hikey) = (midi(lokey)?, midi(hikey)?);
    let keycenter = center.clamp(0, 127) as u8;
    let lovel = number(ops, "lovel").unwrap_or(0.0).clamp(0.0, 127.0) as u8;
    let hivel = number(ops, "hivel").unwrap_or(127.0).clamp(0.0, 127.0) as u8;
    if lokey > hikey || lovel > hivel {
        return None;
    }
    let trigger = match ops.get("trigger").map(|t| t.trim()) {
        None | Some("attack" | "first" | "legato") => Trigger::Attack,
        Some("release" | "release_key") => Trigger::Release,
        Some(_) => return None,
    };
    let tune = number(ops, "tune").unwrap_or(0.0) + number(ops, "transpose").unwrap_or(0.0) * 100.0;
    Some(Region {
        sample: format!("{default_path}{sample}"),
        lokey,
        hikey,
        keycenter,
        lovel,
        hivel,
        trigger,
        tune_cents: tune,
        keytrack: number(ops, "pitch_keytrack").unwrap_or(100.0),
        volume_db: number(ops, "volume").unwrap_or(0.0),
        amplitude: (number(ops, "amplitude").unwrap_or(100.0) / 100.0).clamp(0.0, 1.0),
        veltrack: (modulated(ops, "amp_veltrack", 100.0, cc) / 100.0).clamp(-1.0, 1.0),
        release_seconds: modulated(ops, "ampeg_release", 0.001, cc).max(0.001),
        rt_decay_db: number(ops, "rt_decay").unwrap_or(0.0).max(0.0),
        off_seconds: number(ops, "off_time").unwrap_or(0.006).max(0.001),
        group: number(ops, "group").map_or(0, |g| g as i64),
    })
}

/// Keeps at most `max` velocity layers for each key range and widens the
/// kept layers to cover the dropped ones, so every velocity still sounds.
/// Large libraries such as Salamander have 16 layers; half of them sound
/// almost the same and cost a lot of memory.
pub fn thin_velocity_layers(regions: Vec<Region>, max: usize) -> Vec<Region> {
    let max = max.max(1);
    let mut kept: Vec<Region> = Vec::with_capacity(regions.len());
    let mut groups: Vec<((u8, u8, bool), Vec<Region>)> = Vec::new();
    for r in regions {
        let id = (r.lokey, r.hikey, r.trigger == Trigger::Attack);
        match groups.iter_mut().find(|(g, _)| *g == id) {
            Some((_, list)) => list.push(r),
            None => groups.push((id, vec![r])),
        }
    }
    for ((_, _, attack), mut layers) in groups {
        // Release regions often overlap in velocity on purpose; leave them.
        if !attack || layers.len() <= max {
            kept.extend(layers);
            continue;
        }
        layers.sort_by_key(|r| (r.lovel, r.hivel));
        let n = layers.len();
        // Evenly spread picks that always include the loudest layer.
        let picks: Vec<usize> = (1..=max).map(|i| (i * n).div_ceil(max) - 1).collect();
        let mut low = layers[0].lovel;
        for &i in &picks {
            let mut r = layers[i].clone();
            r.lovel = low;
            low = r.hivel.saturating_add(1);
            kept.push(r);
        }
    }
    kept
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse_files(main: &str, files: &[(&str, &str)]) -> Vec<Region> {
        let mut include = |path: &str| {
            files
                .iter()
                .find(|(name, _)| *name == path)
                .map(|(_, text)| text.to_string())
                .ok_or_else(|| format!("missing {path}"))
        };
        parse(main, &mut include).expect("valid sfz")
    }

    #[test]
    fn note_names_follow_the_sfz_convention() {
        assert_eq!(parse_key("c4"), Some(60));
        assert_eq!(parse_key("C#0"), Some(13));
        assert_eq!(parse_key("Eb3"), Some(51));
        assert_eq!(parse_key("A0"), Some(21));
        assert_eq!(parse_key("C-1"), Some(0));
        assert_eq!(parse_key("108"), Some(108));
        assert_eq!(parse_key("H2"), None);
    }

    #[test]
    fn headers_inherit_and_reset() {
        let regions = parse_files(
            "<control> default_path=Samples/\n\
             <global> volume=-3\n\
             <group> lovel=1 hivel=64 // soft\n\
             <region> key=60 sample=c4p.flac\n\
             <region> lokey=61 hikey=62 pitch_keycenter=61 sample=c#4p.flac volume=-6\n\
             <group> lovel=65\n\
             <region> key=60 sample=c4f.flac",
            &[],
        );
        assert_eq!(regions.len(), 3);
        assert_eq!(regions[0].sample, "Samples/c4p.flac");
        assert_eq!(
            (regions[0].lokey, regions[0].hikey, regions[0].keycenter),
            (60, 60, 60)
        );
        assert_eq!((regions[0].lovel, regions[0].hivel), (1, 64));
        assert_eq!(regions[0].volume_db, -3.0);
        assert_eq!(
            regions[1].sample, "Samples/c#4p.flac",
            "# inside a value is not a directive"
        );
        assert_eq!(regions[1].volume_db, -6.0);
        assert_eq!(
            (regions[2].lovel, regions[2].hivel),
            (65, 127),
            "a new group resets its opcodes"
        );
    }

    #[test]
    fn defines_and_includes_in_the_middle_of_a_line() {
        let regions = parse_files(
            "#define $EXT flac\n#define $TUNE1 5\n#define $TUNE10 -7\n\
             <group> #include \"Data/vel_01.txt\" lovel=1 hivel=26 #include \"Data/region.txt\"\n\
             <group> #include \"Data/vel_02.txt\" lovel=27 hivel=127 #include \"Data/region.txt\"",
            &[
                ("Data/vel_01.txt", "#define $VEL v1\n"),
                ("Data/vel_02.txt", "#define $VEL v2\n"),
                (
                    "Data/region.txt",
                    "<region> tune=$TUNE10 key=60 sample=C4$VEL.$EXT\n<region> tune=$TUNE1 key=61 sample=C#4$VEL.$EXT",
                ),
            ],
        );
        let samples: Vec<_> = regions.iter().map(|r| r.sample.as_str()).collect();
        assert_eq!(
            samples,
            ["C4v1.flac", "C#4v1.flac", "C4v2.flac", "C#4v2.flac"]
        );
        assert_eq!(regions[0].tune_cents, -7.0, "longest define wins");
        assert_eq!(regions[1].tune_cents, 5.0);
        assert_eq!((regions[2].lovel, regions[2].hivel), (27, 127));
    }

    #[test]
    fn sample_paths_may_contain_spaces() {
        let regions = parse_files("<region> sample=Grand Piano/C4 soft.wav key=60", &[]);
        assert_eq!(regions[0].sample, "Grand Piano/C4 soft.wav");
        assert_eq!(regions[0].lokey, 60);
    }

    #[test]
    fn only_the_default_keyswitch_and_matching_cc_conditions_play() {
        let regions = parse_files(
            "<control> set_hdcc20=0.5 set_cc7=100\n\
             <global> sw_default=C0\n\
             <master> sw_last=C0 <region> key=60 sample=natural.flac\n\
             <master> sw_last=C#0 <region> key=60 sample=retuned.flac\n\
             <global> trigger=release <master> locc20=1 <region> key=60 sample=res.flac\n\
             <master> locc21=1 <region> key=60 sample=needs_cc21.flac\n\
             <global> <group> on_locc64=127 <region> sample=pedal.flac\n\
             <group> <region> lorand=0 hirand=0.5 key=61 sample=rr1.flac <region> lorand=0.5 key=61 sample=rr2.flac",
            &[],
        );
        let samples: Vec<_> = regions.iter().map(|r| r.sample.as_str()).collect();
        assert_eq!(samples, ["natural.flac", "res.flac", "rr1.flac"]);
        assert_eq!(regions[1].trigger, Trigger::Release);
    }

    #[test]
    fn cc_modulation_uses_the_control_defaults() {
        let regions = parse_files(
            "<control> set_hdcc72=0.5 set_hdcc99=0.73\n\
             <global> ampeg_release_oncc72=2 amp_veltrack_oncc99=-100\n\
             <region> key=60 sample=a.flac\n<region> key=61 ampeg_release=3 sample=b.flac",
            &[],
        );
        assert!((regions[0].release_seconds - 1.0).abs() < 0.01);
        assert!((regions[1].release_seconds - 4.0).abs() < 0.01);
        assert!((regions[0].veltrack - 0.27).abs() < 0.001);
    }

    #[test]
    fn broken_files_are_errors() {
        let mut none = |p: &str| Err(format!("missing {p}"));
        assert!(parse("<region sample=a.wav", &mut none).is_err());
        assert!(parse("#include \"nope.txt\"", &mut none).is_err());
        let mut forever = |_: &str| Ok("#include \"self.sfz\"".to_string());
        assert!(parse("#include \"self.sfz\"", &mut forever).is_err());
    }

    #[test]
    fn thinning_keeps_the_loudest_layer_and_covers_every_velocity() {
        let mut regions = Vec::new();
        for i in 0..16u8 {
            regions.extend(parse_files(
                &format!(
                    "<region> key=60 lovel={} hivel={} sample=v{}.flac",
                    i * 8,
                    i * 8 + 7,
                    i + 1
                ),
                &[],
            ));
        }
        regions.extend(parse_files(
            "<region> key=60 trigger=release sample=rel.flac",
            &[],
        ));
        let thinned = thin_velocity_layers(regions, 8);
        assert_eq!(thinned.len(), 9);
        let attack: Vec<_> = thinned
            .iter()
            .filter(|r| r.trigger == Trigger::Attack)
            .collect();
        assert_eq!(attack.last().unwrap().sample, "v16.flac");
        assert_eq!(attack[0].lovel, 0);
        assert_eq!(attack.last().unwrap().hivel, 127);
        for pair in attack.windows(2) {
            assert_eq!(pair[1].lovel, pair[0].hivel + 1, "no velocity gap");
        }
        for v in 0..=127 {
            assert_eq!(
                thinned
                    .iter()
                    .filter(|r| r.matches(60, v, Trigger::Attack))
                    .count(),
                1
            );
        }
    }
}
