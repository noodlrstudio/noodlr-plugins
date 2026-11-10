//! Parameter table, shared atomic values, and the params/state extensions.
//!
//! Param ids are persisted by noodlr (and by its presets), so never renumber
//! them; append new ones instead.

use crate::{DelayAudioProcessor, DelayPluginMainThread};
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

pub const SYNC: usize = 0;
pub const DIVISION: usize = 1;
pub const RIGHT_DIVISION: usize = 2;
pub const TIME: usize = 3;
pub const RIGHT_TIME: usize = 4;
pub const FEEDBACK: usize = 5;
pub const MIX: usize = 6;
pub const TONE: usize = 7;
pub const LOW_CUT: usize = 8;
pub const MODE: usize = 9;
pub const CHARACTER: usize = 10;
pub const AGE: usize = 11;
pub const WIDTH: usize = 12;
pub const DUCKING: usize = 13;
pub const FREEZE: usize = 14;
pub const PARAM_COUNT: usize = 15;

pub const MODE_STEREO: u8 = 0;
pub const MODE_PING_PONG: u8 = 1;
pub const MODE_DUAL: u8 = 2;

const STATE_VERSION: u8 = 1;

/// Note values in beats (a quarter note is one beat), shortest first.
pub const DIVISIONS: [(&str, f32); 13] = [
    ("1/32", 0.125),
    ("1/16T", 1.0 / 6.0),
    ("1/16", 0.25),
    ("1/8T", 1.0 / 3.0),
    ("1/16.", 0.375),
    ("1/8", 0.5),
    ("1/4T", 2.0 / 3.0),
    ("1/8.", 0.75),
    ("1/4", 1.0),
    ("1/2T", 4.0 / 3.0),
    ("1/4.", 1.5),
    ("1/2", 2.0),
    ("1/1", 4.0),
];

pub const MIN_TIME_MS: f32 = 10.0;
pub const MAX_TIME_MS: f32 = 2_000.0;
pub const MAX_FEEDBACK: f32 = 1.1;

const SYNC_NAMES: [&str; 2] = ["Free", "Sync"];
const MODE_NAMES: [&str; 3] = ["Stereo", "Ping-pong", "Dual"];
const CHARACTER_NAMES: [&str; 2] = ["Clean", "Tape"];
const FREEZE_NAMES: [&str; 2] = ["Off", "On"];

#[derive(Copy, Clone)]
enum Display {
    Percent,
    Choice(&'static [&'static str]),
    Division,
    Millis,
    Tone,
    LowCut,
}

struct ParamSpec {
    name: &'static [u8],
    module: &'static [u8],
    min: f32,
    max: f32,
    default: f32,
    display: Display,
}

impl ParamSpec {
    const fn stepped(&self) -> bool {
        matches!(self.display, Display::Choice(_) | Display::Division)
    }
}

const fn unit(
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

const fn choice(
    name: &'static [u8],
    module: &'static [u8],
    names: &'static [&'static str],
    default: f32,
) -> ParamSpec {
    ParamSpec {
        name,
        module,
        min: 0.0,
        max: (names.len() - 1) as f32,
        default,
        display: Display::Choice(names),
    }
}

const fn division(name: &'static [u8], default: f32) -> ParamSpec {
    ParamSpec {
        name,
        module: b"Time",
        min: 0.0,
        max: (DIVISIONS.len() - 1) as f32,
        default,
        display: Display::Division,
    }
}

const fn millis(name: &'static [u8], default: f32) -> ParamSpec {
    ParamSpec {
        name,
        module: b"Time",
        min: MIN_TIME_MS,
        max: MAX_TIME_MS,
        default,
        display: Display::Millis,
    }
}

/// Indexed by `id - 1`.
const SPECS: [ParamSpec; PARAM_COUNT] = [
    choice(b"Sync", b"Time", &SYNC_NAMES, 1.0),
    division(b"Division", 7.0),
    division(b"Right Division", 8.0),
    millis(b"Time", 375.0),
    millis(b"Right Time", 500.0),
    ParamSpec {
        name: b"Feedback",
        module: b"Echoes",
        min: 0.0,
        max: MAX_FEEDBACK,
        default: 0.45,
        display: Display::Percent,
    },
    unit(b"Mix", b"Output", 0.35, Display::Percent),
    unit(b"Tone", b"Echoes", 0.7, Display::Tone),
    unit(b"Low Cut", b"Echoes", 0.15, Display::LowCut),
    choice(b"Mode", b"Echoes", &MODE_NAMES, 0.0),
    choice(b"Character", b"Echoes", &CHARACTER_NAMES, 0.0),
    unit(b"Age", b"Echoes", 0.3, Display::Percent),
    unit(b"Width", b"Output", 1.0, Display::Percent),
    unit(b"Ducking", b"Output", 0.0, Display::Percent),
    choice(b"Freeze", b"Echoes", &FREEZE_NAMES, 0.0),
];

/// Listing order for hosts: time, then the echoes, then the output.
const INFO_ORDER: [usize; PARAM_COUNT] = [
    SYNC,
    DIVISION,
    TIME,
    FEEDBACK,
    MIX,
    TONE,
    LOW_CUT,
    MODE,
    RIGHT_DIVISION,
    RIGHT_TIME,
    CHARACTER,
    AGE,
    WIDTH,
    DUCKING,
    FREEZE,
];

/// Normalised 0..1 → the feedback loop's high cut, 400 Hz … 18 kHz.
#[inline]
pub fn tone_hz(value: f32) -> f32 {
    400.0 * 45f32.powf(value)
}

/// Normalised 0..1 → the feedback loop's low cut, 20 Hz … 600 Hz.
#[inline]
pub fn low_cut_hz(value: f32) -> f32 {
    20.0 * 30f32.powf(value)
}

/// A division param value → beats.
#[inline]
pub fn division_beats(value: f32) -> f32 {
    DIVISIONS[(value.round().max(0.0) as usize).min(DIVISIONS.len() - 1)].1
}

fn index_of(id: ClapId) -> Option<usize> {
    let index = (u32::from(id) as usize).checked_sub(1)?;
    (index < PARAM_COUNT).then_some(index)
}

/// Values shared by the main thread and the audio thread.
pub struct DelayParams {
    values: [AtomicU32; PARAM_COUNT],
}

impl Default for DelayParams {
    fn default() -> Self {
        Self::new()
    }
}

impl DelayParams {
    pub fn new() -> Self {
        Self {
            values: std::array::from_fn(|index| AtomicU32::new(SPECS[index].default.to_bits())),
        }
    }

    #[inline]
    pub fn get(&self, index: usize) -> f32 {
        f32::from_bits(self.values[index].load(Ordering::Relaxed))
    }

    #[inline]
    pub fn get_choice(&self, index: usize) -> u8 {
        self.get(index).round() as u8
    }

    pub fn set(&self, index: usize, value: f32) {
        let spec = &SPECS[index];
        let value = if value.is_finite() {
            value
        } else {
            spec.default
        };
        let mut value = value.clamp(spec.min, spec.max);
        if spec.stepped() {
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

impl PluginStateImpl for DelayPluginMainThread<'_> {
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
            return Err(PluginError::Message("Unknown delay state version"));
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

impl PluginMainThreadParams for DelayPluginMainThread<'_> {
    fn count(&self) -> u32 {
        PARAM_COUNT as u32
    }

    fn get_info(&self, param_index: u32, info: &mut ParamInfoWriter) {
        let Some(&index) = INFO_ORDER.get(param_index as usize) else {
            return;
        };
        let spec = &SPECS[index];
        let mut flags = ParamInfoFlags::IS_AUTOMATABLE;
        if spec.stepped() {
            flags |= ParamInfoFlags::IS_STEPPED;
        }
        if matches!(spec.display, Display::Choice(_)) {
            flags |= ParamInfoFlags::IS_ENUM;
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
            Display::Choice(names) => {
                let name = names[(value.round().max(0.0) as usize).min(names.len() - 1)];
                write!(writer, "{name}")
            }
            Display::Division => {
                let index = (value.round().max(0.0) as usize).min(DIVISIONS.len() - 1);
                write!(writer, "{}", DIVISIONS[index].0)
            }
            Display::Millis => {
                if value < 1_000.0 {
                    write!(writer, "{value:.0} ms")
                } else {
                    write!(writer, "{:.2} s", value / 1_000.0)
                }
            }
            Display::Tone | Display::LowCut => {
                let hz = if matches!(SPECS[index].display, Display::Tone) {
                    tone_hz(value)
                } else {
                    low_cut_hz(value)
                };
                if hz < 1_000.0 {
                    write!(writer, "{hz:.0} Hz")
                } else {
                    write!(writer, "{:.1} kHz", hz / 1_000.0)
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

impl PluginAudioProcessorParams for DelayAudioProcessor<'_> {
    fn flush(&mut self, input_parameter_changes: &InputEvents, _output: &mut OutputEvents) {
        for event in input_parameter_changes {
            self.handle_event(event)
        }
    }
}
