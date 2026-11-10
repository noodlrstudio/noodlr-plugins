//! The delay itself: two interpolated lines with filtered, saturated
//! feedback, read heads that crossfade (Clean) or glide (Tape) when the time
//! changes, and freeze, ducking and width on the way out. No allocation after
//! `Delay::new`.

use crate::params::*;
use std::f32::consts::{PI, TAU};

/// The longest time any setting reaches: a whole note at 40 BPM is 6 s.
const MAX_SECONDS: f32 = 6.5;
const MIN_TEMPO: f32 = 20.0;
const MAX_TEMPO: f32 = 400.0;
/// Coefficients and targets refresh this often, in samples.
const CONTROL_FRAMES: usize = 32;
const CROSSFADE_SECONDS: f32 = 0.04;
const TAPE_GLIDE_SECONDS: f32 = 0.18;
const PARAM_SMOOTH_SECONDS: f32 = 0.02;
const FREEZE_SMOOTH_SECONDS: f32 = 0.03;
const WOW_HZ: f32 = 0.55;
const FLUTTER_HZ: f32 = 6.3;
const WOW_SECONDS: f32 = 0.0035;
const FLUTTER_SECONDS: f32 = 0.00025;
/// Below this the loop is plain linear; above it a soft knee keeps runaway
/// feedback under 1.0.
const LIMIT_KNEE: f32 = 0.7;
const DUCK_ATTACK_SECONDS: f32 = 0.005;
const DUCK_RELEASE_SECONDS: f32 = 0.25;
const QUIET: f32 = 1.0e-6;

#[inline]
fn coefficient(seconds: f32, sample_rate: f32) -> f32 {
    1.0 - (-1.0 / (seconds * sample_rate)).exp()
}

/// Linear below the knee, then a tanh shoulder that never passes 1.0.
#[inline]
fn soft_limit(x: f32) -> f32 {
    let magnitude = x.abs();
    if magnitude <= LIMIT_KNEE {
        x
    } else {
        let room = 1.0 - LIMIT_KNEE;
        (LIMIT_KNEE + room * ((magnitude - LIMIT_KNEE) / room).tanh()).copysign(x)
    }
}

/// Tape-style saturation: unity gain at low level, rounding off peaks.
#[inline]
fn saturate(x: f32, drive: f32) -> f32 {
    (x * drive).tanh() / drive
}

/// A power-of-two ring buffer read with four-point Hermite interpolation.
struct Line {
    buffer: Vec<f32>,
    mask: usize,
    write: usize,
}

impl Line {
    fn new(length: usize) -> Self {
        let size = length.next_power_of_two();
        Self {
            buffer: vec![0.0; size],
            mask: size - 1,
            write: 0,
        }
    }

    #[inline]
    fn push(&mut self, sample: f32) {
        self.buffer[self.write] = sample;
        self.write = (self.write + 1) & self.mask;
    }

    /// The sample written `delay` samples before the next write.
    #[inline]
    fn read(&self, delay: f32) -> f32 {
        let delay = delay.max(3.0);
        let position = self.write as f32 - delay + self.buffer.len() as f32;
        let whole = position.floor();
        let fraction = position - whole;
        let index = whole as usize;
        let at = |offset: usize| self.buffer[(index + offset).wrapping_sub(1) & self.mask];
        let (xm1, x0, x1, x2) = (at(0), at(1), at(2), at(3));
        let c1 = 0.5 * (x1 - xm1);
        let c2 = xm1 - 2.5 * x0 + 2.0 * x1 - 0.5 * x2;
        let c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
        ((c3 * fraction + c2) * fraction + c1) * fraction + x0
    }

    fn clear(&mut self) {
        self.buffer.fill(0.0);
    }
}

/// Where a line is read. Clean crossfades to a new time; Tape glides to it,
/// which bends the pitch the way tape does.
struct Head {
    current: f32,
    from: f32,
    /// 1.0 when no crossfade is running.
    fade: f32,
}

impl Head {
    fn new(delay: f32) -> Self {
        Self {
            current: delay,
            from: delay,
            fade: 1.0,
        }
    }

    fn retarget(&mut self, target: f32, tape: bool, glide: f32) {
        if tape {
            if self.fade < 1.0 {
                self.current = self.from + (self.current - self.from) * self.fade;
                self.fade = 1.0;
            }
            self.current += (target - self.current) * glide;
        } else if self.fade >= 1.0 && (target - self.current).abs() > 0.5 {
            self.from = self.current;
            self.current = target;
            self.fade = 0.0;
        }
    }

    #[inline]
    fn read(&mut self, line: &Line, modulation: f32, fade_step: f32) -> f32 {
        let now = line.read(self.current + modulation);
        if self.fade >= 1.0 {
            return now;
        }
        let before = line.read(self.from + modulation);
        // Equal-power so the level holds through the fade.
        let gain = (self.fade * 0.5 * PI).sin();
        let out = before * (1.0 - gain * gain).sqrt() + now * gain;
        self.fade = (self.fade + fade_step).min(1.0);
        out
    }
}

/// Topology-preserving state-variable filter, 12 dB/oct.
#[derive(Default)]
struct Svf {
    ic1: f32,
    ic2: f32,
    a1: f32,
    a2: f32,
    a3: f32,
}

impl Svf {
    fn tune(&mut self, hz: f32, sample_rate: f32) {
        let g = (PI * (hz / sample_rate).min(0.49)).tan();
        let k = std::f32::consts::SQRT_2;
        self.a1 = 1.0 / (1.0 + g * (g + k));
        self.a2 = g * self.a1;
        self.a3 = g * self.a2;
    }

    /// Returns (low, high).
    #[inline]
    fn run(&mut self, x: f32) -> (f32, f32) {
        let v3 = x - self.ic2;
        let v1 = self.a1 * self.ic1 + self.a2 * v3;
        let v2 = self.ic2 + self.a2 * self.ic1 + self.a3 * v3;
        self.ic1 = 2.0 * v1 - self.ic1;
        self.ic2 = 2.0 * v2 - self.ic2;
        let low = v2;
        let band = v1;
        let high = x - std::f32::consts::SQRT_2 * band - low;
        (low, high)
    }

    fn reset(&mut self) {
        self.ic1 = 0.0;
        self.ic2 = 0.0;
    }
}

/// The feedback path for one line: low cut, then high cut.
#[derive(Default)]
struct Loop {
    low_cut: Svf,
    high_cut: Svf,
}

impl Loop {
    #[inline]
    fn run(&mut self, x: f32) -> f32 {
        let (_, high) = self.low_cut.run(x);
        self.high_cut.run(high).0
    }
}

struct Smoothed {
    value: f32,
}

impl Smoothed {
    #[inline]
    fn next(&mut self, target: f32, coefficient: f32) -> f32 {
        self.value += (target - self.value) * coefficient;
        self.value
    }
}

/// Values the processor reads from the params once per control block.
struct Targets {
    left: f32,
    right: f32,
    feedback: f32,
    mix: f32,
    width: f32,
    ducking: f32,
    freeze: f32,
    mode: u8,
    tape: bool,
    age: f32,
}

pub struct Delay {
    sample_rate: f32,
    lines: [Line; 2],
    heads: [Head; 2],
    loops: [Loop; 2],
    tempo: f32,
    feedback: Smoothed,
    mix: Smoothed,
    width: Smoothed,
    freeze: Smoothed,
    duck_envelope: f32,
    wow_phase: f32,
    flutter_phase: f32,
    control_left: usize,
    targets: Targets,
    last_out: f32,
}

impl Delay {
    pub fn new(sample_rate: f32, params: &DelayParams) -> Self {
        let length = (MAX_SECONDS * sample_rate) as usize + 8;
        let mut delay = Self {
            sample_rate,
            lines: [Line::new(length), Line::new(length)],
            heads: [Head::new(0.0), Head::new(0.0)],
            loops: [Loop::default(), Loop::default()],
            tempo: 120.0,
            feedback: Smoothed { value: 0.0 },
            mix: Smoothed { value: 0.0 },
            width: Smoothed { value: 1.0 },
            freeze: Smoothed { value: 0.0 },
            duck_envelope: 0.0,
            wow_phase: 0.0,
            flutter_phase: 0.25,
            control_left: 0,
            targets: Targets {
                left: 0.0,
                right: 0.0,
                feedback: 0.0,
                mix: 0.0,
                width: 1.0,
                ducking: 0.0,
                freeze: 0.0,
                mode: MODE_STEREO,
                tape: false,
                age: 0.0,
            },
            last_out: 0.0,
        };
        delay.control(params);
        // Start settled rather than gliding in from nothing.
        delay.heads = [Head::new(delay.targets.left), Head::new(delay.targets.right)];
        delay.feedback.value = delay.targets.feedback;
        delay.mix.value = delay.targets.mix;
        delay.width.value = delay.targets.width;
        delay.freeze.value = delay.targets.freeze;
        delay
    }

    /// The host's tempo, when it has one.
    pub fn set_tempo(&mut self, bpm: f64) {
        let bpm = bpm as f32;
        if bpm.is_finite() && (MIN_TEMPO..=MAX_TEMPO).contains(&bpm) {
            self.tempo = bpm;
        }
    }

    pub fn tempo(&self) -> f32 {
        self.tempo
    }

    /// Delay times in samples for the current params and tempo.
    fn times(&self, params: &DelayParams) -> (f32, f32) {
        let max = MAX_SECONDS * self.sample_rate - 8.0;
        let beat = 60.0 / self.tempo;
        let sync = params.get_choice(SYNC) == 1;
        let seconds = |division: usize, time: usize| {
            if sync {
                division_beats(params.get(division)) * beat
            } else {
                params.get(time) / 1_000.0
            }
        };
        let left = seconds(DIVISION, TIME);
        let right = if params.get_choice(MODE) == MODE_DUAL {
            seconds(RIGHT_DIVISION, RIGHT_TIME)
        } else {
            left
        };
        (
            (left * self.sample_rate).clamp(4.0, max),
            (right * self.sample_rate).clamp(4.0, max),
        )
    }

    fn control(&mut self, params: &DelayParams) {
        let (left, right) = self.times(params);
        let tone = tone_hz(params.get(TONE));
        let low_cut = low_cut_hz(params.get(LOW_CUT));
        for path in &mut self.loops {
            path.high_cut.tune(tone, self.sample_rate);
            path.low_cut.tune(low_cut, self.sample_rate);
        }
        self.targets = Targets {
            left,
            right,
            feedback: params.get(FEEDBACK),
            mix: params.get(MIX),
            width: params.get(WIDTH),
            ducking: params.get(DUCKING),
            freeze: params.get_choice(FREEZE).min(1) as f32,
            mode: params.get_choice(MODE),
            tape: params.get_choice(CHARACTER) == 1,
            age: params.get(AGE),
        };
        let glide = coefficient(TAPE_GLIDE_SECONDS, self.sample_rate) * CONTROL_FRAMES as f32;
        let tape = self.targets.tape;
        self.heads[0].retarget(left, tape, glide.min(1.0));
        self.heads[1].retarget(right, tape, glide.min(1.0));
    }

    /// Processes stereo audio in place.
    pub fn render(&mut self, left: &mut [f32], right: &mut [f32], params: &DelayParams) {
        let sr = self.sample_rate;
        let smooth = coefficient(PARAM_SMOOTH_SECONDS, sr);
        let freeze_smooth = coefficient(FREEZE_SMOOTH_SECONDS, sr);
        let duck_attack = coefficient(DUCK_ATTACK_SECONDS, sr);
        let duck_release = coefficient(DUCK_RELEASE_SECONDS, sr);
        let fade_step = 1.0 / (CROSSFADE_SECONDS * sr);
        let wow_step = WOW_HZ / sr;
        let flutter_step = FLUTTER_HZ / sr;
        let mut peak = 0.0f32;

        for (l, r) in left.iter_mut().zip(right.iter_mut()) {
            if self.control_left == 0 {
                self.control(params);
                self.control_left = CONTROL_FRAMES;
            }
            self.control_left -= 1;
            let t = &self.targets;
            let feedback = self.feedback.next(t.feedback, smooth);
            let mix = self.mix.next(t.mix, smooth);
            let width = self.width.next(t.width, smooth);
            let frozen = self.freeze.next(t.freeze, freeze_smooth);

            let modulation = if t.tape {
                self.wow_phase = (self.wow_phase + wow_step).fract();
                self.flutter_phase = (self.flutter_phase + flutter_step).fract();
                t.age
                    * sr
                    * (WOW_SECONDS * (TAU * self.wow_phase).sin()
                        + FLUTTER_SECONDS * (TAU * self.flutter_phase).sin())
            } else {
                0.0
            };

            let dry_l = *l;
            let dry_r = *r;
            let wet_l = self.heads[0].read(&self.lines[0], modulation, fade_step);
            let wet_r = self.heads[1].read(&self.lines[1], modulation, fade_step);

            // Frozen, the loop holds exactly what it has: no new input, no
            // filtering, unity feedback.
            let loop_gain = feedback + (1.0 - feedback) * frozen;
            let drive = 1.0 + 2.0 * t.age;
            let shape = |path: &mut Loop, x: f32| {
                let filtered = path.run(x);
                let filtered = if t.tape { saturate(filtered, drive) } else { filtered };
                filtered + (x - filtered) * frozen
            };
            let back_l = shape(&mut self.loops[0], wet_l) * loop_gain;
            let back_r = shape(&mut self.loops[1], wet_r) * loop_gain;
            let input = 1.0 - frozen;

            let (into_l, into_r) = if t.mode == MODE_PING_PONG {
                // The input goes in on the left and bounces across.
                (0.5 * (dry_l + dry_r) * input + back_r, back_l)
            } else {
                (dry_l * input + back_l, dry_r * input + back_r)
            };
            self.lines[0].push(soft_limit(into_l));
            self.lines[1].push(soft_limit(into_r));

            let level = dry_l.abs().max(dry_r.abs());
            let rate = if level > self.duck_envelope { duck_attack } else { duck_release };
            self.duck_envelope += (level - self.duck_envelope) * rate;
            let duck = 1.0 / (1.0 + 8.0 * t.ducking * self.duck_envelope);

            let mid = 0.5 * (wet_l + wet_r);
            let side = 0.5 * (wet_l - wet_r) * width;
            let wet_gain = (2.0 * mix).min(1.0) * duck;
            let dry_gain = (2.0 * (1.0 - mix)).min(1.0);
            *l = dry_l * dry_gain + (mid + side) * wet_gain;
            *r = dry_r * dry_gain + (mid - side) * wet_gain;
            peak = peak.max(wet_l.abs()).max(wet_r.abs()).max(level);
        }
        self.last_out = peak;
    }

    /// True while anything is still sounding or held.
    pub fn is_active(&self) -> bool {
        self.last_out > QUIET || self.targets.freeze > 0.0
    }

    pub fn reset(&mut self) {
        for line in &mut self.lines {
            line.clear();
        }
        for path in &mut self.loops {
            path.low_cut.reset();
            path.high_cut.reset();
        }
        self.duck_envelope = 0.0;
        self.last_out = 0.0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SR: f32 = 48_000.0;

    fn delay_with(set: &[(usize, f32)]) -> (Delay, DelayParams) {
        let params = DelayParams::new();
        for &(index, value) in set {
            params.set(index, value);
        }
        (Delay::new(SR, &params), params)
    }

    /// Runs an impulse through and returns `frames` of output per channel.
    fn impulse(delay: &mut Delay, params: &DelayParams, frames: usize) -> (Vec<f32>, Vec<f32>) {
        let mut left = vec![0.0; frames];
        let mut right = vec![0.0; frames];
        left[0] = 1.0;
        right[0] = 1.0;
        for start in (0..frames).step_by(128) {
            let end = (start + 128).min(frames);
            let (l, r) = (&mut left[start..end], &mut right[start..end]);
            delay.render(l, r, params);
        }
        (left, right)
    }

    fn peak_index(samples: &[f32], from: usize) -> usize {
        let mut best = from;
        for index in from..samples.len() {
            if samples[index].abs() > samples[best].abs() {
                best = index;
            }
        }
        best
    }

    #[test]
    fn a_synced_echo_lands_on_the_note_value() {
        // 1/8. at 120 BPM is 375 ms.
        let (mut delay, params) = delay_with(&[(SYNC, 1.0), (DIVISION, 7.0), (MIX, 1.0)]);
        delay.set_tempo(120.0);
        let (left, _) = impulse(&mut delay, &params, 24_000);
        let echo = peak_index(&left, 100);
        assert!((echo as i64 - 18_000).abs() <= 2, "echo at {echo}");
    }

    #[test]
    fn the_echo_follows_a_tempo_change() {
        let (mut delay, params) =
            delay_with(&[(SYNC, 1.0), (DIVISION, 8.0), (MIX, 1.0), (FEEDBACK, 0.0)]);
        delay.set_tempo(100.0);
        // Let the crossfade to the new time finish before the impulse.
        let mut silence = vec![0.0; 9_600];
        let mut silence_r = silence.clone();
        delay.render(&mut silence, &mut silence_r, &params);
        let (left, _) = impulse(&mut delay, &params, 40_000);
        // A quarter at 100 BPM is 600 ms.
        let echo = peak_index(&left, 100);
        assert!((echo as i64 - 28_800).abs() <= 2, "echo at {echo}");
    }

    #[test]
    fn free_time_uses_milliseconds() {
        let (mut delay, params) = delay_with(&[(SYNC, 0.0), (TIME, 250.0), (MIX, 1.0)]);
        let (left, _) = impulse(&mut delay, &params, 20_000);
        let echo = peak_index(&left, 100);
        assert!((echo as i64 - 12_000).abs() <= 2, "echo at {echo}");
    }

    #[test]
    fn ping_pong_alternates_sides() {
        let (mut delay, params) = delay_with(&[
            (SYNC, 0.0),
            (TIME, 100.0),
            (MIX, 1.0),
            (FEEDBACK, 0.8),
            (MODE, MODE_PING_PONG as f32),
            (TONE, 1.0),
            (LOW_CUT, 0.0),
        ]);
        let (left, right) = impulse(&mut delay, &params, 12_000);
        let at = |samples: &[f32], index: usize| samples[index - 3..index + 3]
            .iter()
            .fold(0.0f32, |peak, sample| peak.max(sample.abs()));
        // First echo left only, second right only.
        assert!(at(&left, 4_800) > 0.3);
        assert!(at(&right, 4_800) < 0.01);
        assert!(at(&right, 9_600) > 0.2);
        assert!(at(&left, 9_600) < 0.01);
    }

    #[test]
    fn runaway_feedback_stays_bounded() {
        let (mut delay, params) =
            delay_with(&[(SYNC, 0.0), (TIME, 30.0), (MIX, 1.0), (FEEDBACK, MAX_FEEDBACK)]);
        let (left, right) = impulse(&mut delay, &params, 480_000);
        let peak = left
            .iter()
            .chain(right.iter())
            .fold(0.0f32, |peak, sample| peak.max(sample.abs()));
        assert!(peak.is_finite() && peak <= 1.05, "peak {peak}");
        assert!(left[470_000..].iter().any(|sample| sample.abs() > 0.05));
    }

    #[test]
    fn silence_in_gives_silence_out() {
        let (mut delay, params) = delay_with(&[]);
        let mut left = vec![0.0; 48_000];
        let mut right = vec![0.0; 48_000];
        delay.render(&mut left, &mut right, &params);
        assert!(left.iter().chain(right.iter()).all(|sample| *sample == 0.0));
        assert!(!delay.is_active());
    }

    #[test]
    fn freeze_holds_the_echoes() {
        let (mut delay, params) = delay_with(&[(SYNC, 0.0), (TIME, 200.0), (MIX, 1.0), (FEEDBACK, 0.3)]);
        let (_, _) = impulse(&mut delay, &params, 9_700);
        params.set(FREEZE, 1.0);
        // Ten seconds on, with input that freeze must ignore.
        let mut left = vec![0.5; 480_000];
        let mut right = vec![0.5; 480_000];
        for start in (0..left.len()).step_by(128) {
            let end = start + 128;
            delay.render(&mut left[start..end], &mut right[start..end], &params);
        }
        let tail = left[470_000..]
            .iter()
            .fold(0.0f32, |peak, sample| peak.max((sample - 0.0).abs()));
        // Mix 1.0 removes the dry signal, so what is left is the held echo.
        assert!(tail > 0.05, "tail {tail}");
        assert!(tail < 1.0);
    }

    #[test]
    fn a_time_change_does_not_click() {
        let (mut delay, params) = delay_with(&[(SYNC, 0.0), (TIME, 300.0), (MIX, 1.0), (FEEDBACK, 0.0)]);
        // A steady sine through the delay, then a jump in time.
        let mut phase = 0.0f32;
        let mut previous = 0.0f32;
        let mut worst = 0.0f32;
        for block in 0..400 {
            if block == 200 {
                params.set(TIME, 120.0);
            }
            let mut left = [0.0f32; 128];
            for sample in &mut left {
                phase = (phase + 220.0 / SR).fract();
                *sample = 0.5 * (TAU * phase).sin();
            }
            let mut right = left;
            delay.render(&mut left, &mut right, &params);
            if block > 100 {
                for sample in left {
                    worst = worst.max((sample - previous).abs());
                    previous = sample;
                }
            } else {
                previous = left[127];
            }
        }
        // A 220 Hz sine at 0.5 moves at most ~0.0145 per sample.
        assert!(worst < 0.03, "largest step {worst}");
    }
}
