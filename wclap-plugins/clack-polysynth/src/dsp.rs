//! Small, allocation-free DSP building blocks.

use std::f32::consts::{PI, TAU};

/// Rational tanh approximation; exact enough for saturation, clamps at ±3.
#[inline]
pub fn fast_tanh(x: f32) -> f32 {
    let x = x.clamp(-3.0, 3.0);
    let x2 = x * x;
    x * (27.0 + x2) / (27.0 + 9.0 * x2)
}

/// PolyBLEP residual for a discontinuity at phase 0 (phase in 0..1).
#[inline]
fn poly_blep(t: f32, dt: f32) -> f32 {
    if t < dt {
        let x = t / dt;
        x + x - x * x - 1.0
    } else if t > 1.0 - dt {
        let x = (t - 1.0) / dt;
        x * x + x + x + 1.0
    } else {
        0.0
    }
}

#[derive(Copy, Clone, PartialEq, Eq)]
pub enum Wave {
    Sine,
    Triangle,
    Saw,
    Square,
}

impl Wave {
    pub fn from_value(value: f32) -> Self {
        match value.round() as i32 {
            0 => Wave::Sine,
            1 => Wave::Triangle,
            3 => Wave::Square,
            _ => Wave::Saw,
        }
    }
}

/// One band-limited oscillator sample at phase `t` with increment `dt`.
#[inline]
pub fn oscillator(wave: Wave, t: f32, dt: f32) -> f32 {
    match wave {
        Wave::Sine => (t * TAU).sin(),
        // Harmonics fall at 1/n², so the naive triangle barely aliases.
        Wave::Triangle => 1.0 - 4.0 * (t - 0.5).abs(),
        Wave::Saw => 2.0 * t - 1.0 - poly_blep(t, dt),
        Wave::Square => {
            let half = if t < 0.5 { 1.0 } else { -1.0 };
            let shifted = (t + 0.5).fract();
            half + poly_blep(t, dt) - poly_blep(shifted, dt)
        }
    }
}

#[inline]
pub fn advance(phase: &mut f32, dt: f32) {
    *phase += dt;
    if *phase >= 1.0 {
        *phase -= 1.0;
    }
}

/// Zavalishin topology-preserving state-variable low-pass.
#[derive(Copy, Clone, Default)]
pub struct Svf {
    ic1: f32,
    ic2: f32,
}

#[derive(Copy, Clone, Default)]
pub struct SvfCoefs {
    a1: f32,
    a2: f32,
    a3: f32,
}

impl SvfCoefs {
    pub fn low_pass(cutoff: f32, sample_rate: f32, k: f32) -> Self {
        let g = (PI * cutoff / sample_rate).tan();
        let a1 = 1.0 / (1.0 + g * (g + k));
        let a2 = g * a1;
        Self { a1, a2, a3: g * a2 }
    }
}

impl Svf {
    pub const ZERO: Self = Self { ic1: 0.0, ic2: 0.0 };

    #[inline]
    pub fn tick(&mut self, c: &SvfCoefs, input: f32) -> f32 {
        let v3 = input - self.ic2;
        let v1 = c.a1 * self.ic1 + c.a2 * v3;
        let v2 = self.ic2 + c.a2 * self.ic1 + c.a3 * v3;
        self.ic1 = 2.0 * v1 - self.ic1;
        self.ic2 = 2.0 * v2 - self.ic2;
        v2
    }
}

#[derive(Copy, Clone, PartialEq, Eq)]
enum Stage {
    Idle,
    Attack,
    Decay,
    Sustain,
    Release,
}

/// Envelope times and levels, derived once per control block.
#[derive(Copy, Clone)]
pub struct EnvCoefs {
    pub attack_step: f32,
    pub decay: f32,
    pub sustain: f32,
    pub release: f32,
}

impl EnvCoefs {
    /// Times are in seconds.
    pub fn new(attack: f32, decay: f32, sustain: f32, release: f32, sample_rate: f32) -> Self {
        Self {
            attack_step: 1.0 / (attack * sample_rate).max(1.0),
            // Decay reaches 1% of the way to sustain in `decay` seconds.
            decay: (-4.6 / (decay * sample_rate).max(1.0)).exp(),
            sustain,
            // Release falls by 60 dB in `release` seconds.
            release: (-6.9 / (release * sample_rate).max(1.0)).exp(),
        }
    }
}

/// Linear-attack, exponential decay/release ADSR.
#[derive(Copy, Clone)]
pub struct Envelope {
    stage: Stage,
    value: f32,
}

impl Envelope {
    pub const fn new() -> Self {
        Self {
            stage: Stage::Idle,
            value: 0.0,
        }
    }

    /// Starts from the current level, so retriggers never click.
    pub fn gate_on(&mut self) {
        self.stage = Stage::Attack;
    }

    pub fn gate_off(&mut self) {
        if self.stage != Stage::Idle {
            self.stage = Stage::Release;
        }
    }

    pub fn reset(&mut self) {
        *self = Self::new();
    }

    pub fn is_idle(&self) -> bool {
        self.stage == Stage::Idle
    }

    pub fn is_releasing(&self) -> bool {
        self.stage == Stage::Release
    }

    pub fn value(&self) -> f32 {
        self.value
    }

    #[inline]
    pub fn next(&mut self, c: &EnvCoefs) -> f32 {
        match self.stage {
            Stage::Idle => {}
            Stage::Attack => {
                self.value += c.attack_step;
                if self.value >= 1.0 {
                    self.value = 1.0;
                    self.stage = Stage::Decay;
                }
            }
            Stage::Decay => {
                self.value = c.sustain + (self.value - c.sustain) * c.decay;
                if (self.value - c.sustain).abs() < 1e-4 {
                    self.stage = Stage::Sustain;
                }
            }
            // Glide toward a moving sustain level instead of jumping.
            Stage::Sustain => self.value += (c.sustain - self.value) * 0.002,
            Stage::Release => {
                self.value *= c.release;
                if self.value < 1e-4 {
                    self.value = 0.0;
                    self.stage = Stage::Idle;
                }
            }
        }
        self.value
    }
}
