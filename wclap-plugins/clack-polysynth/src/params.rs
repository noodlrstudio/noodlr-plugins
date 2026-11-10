//! Parameter table, shared atomic values, and the params/state extensions.
//!
//! Param ids are persisted by noodlr (and by its presets), so never renumber
//! them; append new ones instead.

use crate::{PolySynthAudioProcessor, PolySynthPluginMainThread};
use clack_extensions::params::*;
use clack_extensions::state::PluginStateImpl;
use clack_plugin::events::event_types::ParamValueEvent;
use clack_plugin::events::spaces::CoreEventSpace;
use clack_plugin::prelude::*;
use clack_plugin::stream::{InputStream, OutputStream};
use std::ffi::CStr;
use std::fmt::Write as _;
use std::io::{Read, Write as _};
use std::sync::atomic::{AtomicU32, Ordering};

pub const VOLUME: usize = 0;
pub const WAVE: usize = 1;
pub const DETUNE: usize = 2;
pub const SUB: usize = 3;
pub const CUTOFF: usize = 4;
pub const RESONANCE: usize = 5;
pub const ENV_AMOUNT: usize = 6;
pub const ENV_DECAY: usize = 7;
pub const ATTACK: usize = 8;
pub const DECAY: usize = 9;
pub const SUSTAIN: usize = 10;
pub const RELEASE: usize = 11;
pub const DRIVE: usize = 12;
pub const VIBRATO: usize = 13;
pub const PARAM_COUNT: usize = 14;

const STATE_VERSION: u8 = 1;
const WAVE_NAMES: [&str; 4] = ["Sine", "Triangle", "Saw", "Square"];

#[derive(Copy, Clone)]
enum Display {
    Percent,
    Wave,
    Cents(f32),
    Hertz,
    Seconds(f32),
}

struct ParamSpec {
    name: &'static [u8],
    module: &'static [u8],
    min: f32,
    max: f32,
    default: f32,
    display: Display,
}

const fn spec(
    name: &'static [u8],
    module: &'static [u8],
    default: f32,
    display: Display,
) -> ParamSpec {
    ParamSpec {
        name,
        module,
        min: 0.0,
        max: 1.0,
        default,
        display,
    }
}

/// Indexed by `id - 1`.
const SPECS: [ParamSpec; PARAM_COUNT] = [
    spec(b"Volume", b"Output", 0.6, Display::Percent),
    ParamSpec {
        name: b"Wave",
        module: b"Oscillator",
        min: 0.0,
        max: 3.0,
        default: 2.0,
        display: Display::Wave,
    },
    spec(b"Detune", b"Oscillator", 0.3, Display::Cents(DETUNE_CENTS)),
    spec(b"Sub", b"Oscillator", 0.2, Display::Percent),
    spec(b"Cutoff", b"Filter", 0.62, Display::Hertz),
    spec(b"Resonance", b"Filter", 0.2, Display::Percent),
    spec(b"Env Amount", b"Filter", 0.35, Display::Percent),
    spec(
        b"Env Decay",
        b"Filter",
        0.45,
        Display::Seconds(ENV_DECAY_MAX),
    ),
    spec(b"Attack", b"Amp", 0.08, Display::Seconds(ATTACK_MAX)),
    spec(b"Decay", b"Amp", 0.4, Display::Seconds(DECAY_MAX)),
    spec(b"Sustain", b"Amp", 0.7, Display::Percent),
    spec(b"Release", b"Amp", 0.4, Display::Seconds(RELEASE_MAX)),
    spec(b"Drive", b"Output", 0.15, Display::Percent),
    spec(b"Vibrato", b"Output", 0.0, Display::Cents(VIBRATO_CENTS)),
];

/// Listing order for hosts: signal flow, with the output stage last. Ids
/// stay `index + 1` regardless.
const INFO_ORDER: [usize; PARAM_COUNT] = [
    WAVE, DETUNE, SUB, CUTOFF, RESONANCE, ENV_AMOUNT, ENV_DECAY, ATTACK, DECAY, SUSTAIN, RELEASE,
    DRIVE, VIBRATO, VOLUME,
];

pub const DETUNE_CENTS: f32 = 35.0;
pub const VIBRATO_CENTS: f32 = 30.0;
pub const ATTACK_MAX: f32 = 4.0;
pub const DECAY_MAX: f32 = 4.0;
pub const ENV_DECAY_MAX: f32 = 4.0;
pub const RELEASE_MAX: f32 = 6.0;

/// Normalised 0..1 → seconds on a cubic curve, so short times get most travel.
#[inline]
pub fn seconds(value: f32, max: f32) -> f32 {
    0.001 + value * value * value * max
}

/// Normalised 0..1 → 30 Hz … ~19.5 kHz, exponentially.
#[inline]
pub fn cutoff_hz(value: f32) -> f32 {
    30.0 * (value * 9.35).exp2()
}

/// Normalised 0..1 → cents on a square curve.
#[inline]
pub fn cents(value: f32, max: f32) -> f32 {
    value * value * max
}

fn index_of(id: ClapId) -> Option<usize> {
    let index = (u32::from(id) as usize).checked_sub(1)?;
    (index < PARAM_COUNT).then_some(index)
}

/// Values shared by the main thread and the audio thread.
pub struct PolySynthParams {
    values: [AtomicU32; PARAM_COUNT],
}

impl PolySynthParams {
    pub fn new() -> Self {
        Self {
            values: std::array::from_fn(|index| AtomicU32::new(SPECS[index].default.to_bits())),
        }
    }

    #[inline]
    pub fn get(&self, index: usize) -> f32 {
        f32::from_bits(self.values[index].load(Ordering::Relaxed))
    }

    pub fn set(&self, index: usize, value: f32) {
        let spec = &SPECS[index];
        let value = if value.is_finite() {
            value
        } else {
            spec.default
        };
        let mut value = value.clamp(spec.min, spec.max);
        if matches!(spec.display, Display::Wave) {
            value = value.round();
        }
        self.values[index].store(value.to_bits(), Ordering::Relaxed);
    }

    pub fn handle_event(&self, event: &ParamValueEvent) {
        if let Some(index) = event.param_id().and_then(index_of) {
            self.set(index, event.value() as f32);
        }
    }
}

impl PluginStateImpl for PolySynthPluginMainThread<'_> {
    fn save(&self, output: &mut OutputStream) -> Result<(), PluginError> {
        output.write_all(&[STATE_VERSION, PARAM_COUNT as u8])?;
        for index in 0..PARAM_COUNT {
            output.write_all(&self.shared.params.get(index).to_le_bytes())?;
        }
        Ok(())
    }

    fn load(&self, input: &mut InputStream) -> Result<(), PluginError> {
        let mut header = [0; 2];
        input.read_exact(&mut header)?;
        if header[0] != STATE_VERSION {
            return Err(PluginError::Message("Unknown polysynth state version"));
        }
        // Older saves with fewer params keep defaults for the rest.
        let count = (header[1] as usize).min(PARAM_COUNT);
        for index in 0..count {
            let mut bytes = [0; 4];
            input.read_exact(&mut bytes)?;
            self.shared.params.set(index, f32::from_le_bytes(bytes));
        }
        Ok(())
    }
}

impl PluginMainThreadParams for PolySynthPluginMainThread<'_> {
    fn count(&self) -> u32 {
        PARAM_COUNT as u32
    }

    fn get_info(&self, param_index: u32, info: &mut ParamInfoWriter) {
        let Some(&index) = INFO_ORDER.get(param_index as usize) else {
            return;
        };
        let spec = &SPECS[index];
        let mut flags = ParamInfoFlags::IS_AUTOMATABLE;
        if matches!(spec.display, Display::Wave) {
            flags |= ParamInfoFlags::IS_STEPPED;
        }
        info.set(&ParamInfo {
            id: ClapId::new(index as u32 + 1),
            flags,
            cookie: Default::default(),
            name: spec.name,
            module: spec.module,
            min_value: spec.min as f64,
            max_value: spec.max as f64,
            default_value: spec.default as f64,
        });
    }

    fn get_value(&self, param_id: ClapId) -> Option<f64> {
        index_of(param_id).map(|index| self.shared.params.get(index) as f64)
    }

    fn value_to_text(
        &self,
        param_id: ClapId,
        value: f64,
        writer: &mut ParamDisplayWriter,
    ) -> std::fmt::Result {
        let index = index_of(param_id).ok_or(std::fmt::Error)?;
        let value = value as f32;
        match SPECS[index].display {
            Display::Percent => write!(writer, "{:.0} %", value * 100.0),
            Display::Wave => {
                let name = WAVE_NAMES[(value.round() as usize).min(WAVE_NAMES.len() - 1)];
                write!(writer, "{name}")
            }
            Display::Cents(max) => write!(writer, "{:.1} ct", cents(value, max)),
            Display::Hertz => {
                let hz = cutoff_hz(value);
                if hz < 1000.0 {
                    write!(writer, "{hz:.0} Hz")
                } else {
                    write!(writer, "{:.1} kHz", hz / 1000.0)
                }
            }
            Display::Seconds(max) => {
                let time = seconds(value, max);
                if time < 1.0 {
                    write!(writer, "{:.0} ms", time * 1000.0)
                } else {
                    write!(writer, "{time:.2} s")
                }
            }
        }
    }

    fn text_to_value(&self, _param_id: ClapId, _text: &CStr) -> Option<f64> {
        None
    }

    fn flush(&self, input_parameter_changes: &InputEvents, _output: &mut OutputEvents) {
        for event in input_parameter_changes {
            if let Some(CoreEventSpace::ParamValue(event)) = event.as_core_event() {
                self.shared.params.handle_event(event)
            }
        }
    }
}

impl PluginAudioProcessorParams for PolySynthAudioProcessor<'_> {
    fn flush(&mut self, input_parameter_changes: &InputEvents, _output: &mut OutputEvents) {
        for event in input_parameter_changes {
            self.handle_event(event)
        }
    }
}
