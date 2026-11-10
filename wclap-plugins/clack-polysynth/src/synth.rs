//! The polyphonic voice engine: three detuned band-limited oscillators and a
//! sub per voice, a 4-pole state-variable low-pass with its own envelope, and
//! an amp ADSR, summed through a soft limiter into a stereo pair.

use crate::dsp::*;
use crate::params::*;
use clack_plugin::events::Match;
use clack_plugin::events::event_types::{NoteChokeEvent, NoteOffEvent, NoteOnEvent};
use std::f32::consts::TAU;

const VOICE_COUNT: usize = 16;
/// Coefficients (cutoff, envelope times) refresh at this many samples.
const CONTROL_BLOCK: usize = 16;
const VOICE_GAIN: f32 = 0.28;
const VIBRATO_HZ: f32 = 5.2;
/// Filter envelope range at full Env Amount, in octaves.
const ENV_OCTAVES: f32 = 7.0;

#[derive(Copy, Clone)]
struct Voice {
    channel: u8,
    key: u8,
    note_id: Option<u32>,
    age: u64,
    velocity: f32,
    frequency: f32,
    /// Centre, lower and upper detuned oscillator phases (0..1).
    phases: [f32; 3],
    sub_phase: f32,
    amp: Envelope,
    filter_env: Envelope,
    /// [stage][channel]
    filters: [[Svf; 2]; 2],
}

impl Voice {
    const fn new() -> Self {
        Self {
            channel: 0,
            key: 0,
            note_id: None,
            age: 0,
            velocity: 0.0,
            frequency: 440.0,
            phases: [0.0; 3],
            sub_phase: 0.0,
            amp: Envelope::new(),
            filter_env: Envelope::new(),
            filters: [[Svf::ZERO; 2]; 2],
        }
    }

    fn is_active(&self) -> bool {
        !self.amp.is_idle()
    }

    fn matches(&self, channel: Match<u16>, key: Match<u16>, note_id: Match<u32>) -> bool {
        channel.matches(self.channel)
            && key.matches(self.key)
            && note_id.matches(match self.note_id {
                None => Match::All,
                Some(id) => Match::Specific(id),
            })
    }

    fn render(&mut self, c: &Controls, left: &mut [f32], right: &mut [f32]) {
        let dt = self.frequency * c.pitch / c.sample_rate;
        let dts = [dt, dt * c.detune_down, dt * c.detune_up];
        let sub_dt = dt * 0.5;
        let velocity_filter = 0.5 + 0.5 * self.velocity;
        let key_track = ((self.key as f32 - 60.0) / 24.0).exp2();
        let cutoff = (c.cutoff
            * (c.env_octaves * self.filter_env.value() * velocity_filter).exp2()
            * key_track)
            .clamp(20.0, c.sample_rate * 0.45);
        let stage_one = SvfCoefs::low_pass(cutoff, c.sample_rate, 1.848);
        let stage_two = SvfCoefs::low_pass(cutoff, c.sample_rate, c.resonance_k);
        let gain = VOICE_GAIN * (0.35 + 0.65 * self.velocity);

        for (out_l, out_r) in left.iter_mut().zip(right.iter_mut()) {
            let centre = oscillator(c.wave, self.phases[0], dts[0]);
            let (mut l, mut r) = if c.spread > 0.0 {
                let low = oscillator(c.wave, self.phases[1], dts[1]);
                let high = oscillator(c.wave, self.phases[2], dts[2]);
                (
                    (centre + c.spread * low) * c.spread_norm,
                    (centre + c.spread * high) * c.spread_norm,
                )
            } else {
                (centre, centre)
            };
            if c.sub > 0.0 {
                let sub = c.sub * (self.sub_phase * TAU).sin();
                l += sub;
                r += sub;
            }
            if c.drive_gain > 1.0 {
                l = fast_tanh(l * c.drive_gain) * c.drive_norm;
                r = fast_tanh(r * c.drive_gain) * c.drive_norm;
            }
            let [first, second] = &mut self.filters;
            l = second[0].tick(&stage_two, first[0].tick(&stage_one, l));
            r = second[1].tick(&stage_two, first[1].tick(&stage_one, r));

            let level = self.amp.next(&c.amp) * gain;
            self.filter_env.next(&c.filter);
            *out_l += l * level;
            *out_r += r * level;

            for (phase, step) in self.phases.iter_mut().zip(dts) {
                advance(phase, step);
            }
            advance(&mut self.sub_phase, sub_dt);
        }
    }
}

/// Per-control-block snapshot of the parameters, already mapped to DSP units.
struct Controls {
    sample_rate: f32,
    wave: Wave,
    pitch: f32,
    detune_up: f32,
    detune_down: f32,
    spread: f32,
    spread_norm: f32,
    sub: f32,
    cutoff: f32,
    resonance_k: f32,
    env_octaves: f32,
    drive_gain: f32,
    drive_norm: f32,
    amp: EnvCoefs,
    filter: EnvCoefs,
}

pub struct Synth {
    voices: Box<[Voice]>,
    sample_rate: f32,
    clock: u64,
    vibrato_phase: f32,
    cutoff: f32,
    volume: f32,
    seed: u32,
}

impl Synth {
    pub fn new(sample_rate: f32, params: &PolySynthParams) -> Self {
        Self {
            voices: vec![Voice::new(); VOICE_COUNT].into_boxed_slice(),
            sample_rate,
            clock: 0,
            vibrato_phase: 0.0,
            cutoff: cutoff_hz(params.get(CUTOFF)),
            volume: params.get(VOLUME),
            seed: 0x1234_5678,
        }
    }

    fn random_phase(&mut self) -> f32 {
        // xorshift32: deterministic, allocation-free start phases.
        self.seed ^= self.seed << 13;
        self.seed ^= self.seed >> 17;
        self.seed ^= self.seed << 5;
        (self.seed >> 8) as f32 / (1u32 << 24) as f32
    }

    pub fn has_active_voices(&self) -> bool {
        self.voices.iter().any(Voice::is_active)
    }

    pub fn stop_all(&mut self) {
        for voice in self.voices.iter_mut() {
            voice.amp.reset();
            voice.filter_env.reset();
        }
    }

    pub fn note_on(&mut self, event: &NoteOnEvent) {
        if !event.port_index().matches(0u16) {
            return;
        }
        let (Match::Specific(channel), Match::Specific(key)) = (event.channel(), event.key())
        else {
            return;
        };
        let (channel, key) = (channel as u8, key as u8);
        self.clock += 1;
        let velocity = (event.velocity() as f32).clamp(0.0, 1.0);

        // Same key again: retrigger in place so phases (and sound) continue.
        let index = self
            .voices
            .iter()
            .position(|v| v.is_active() && v.channel == channel && v.key == key)
            .or_else(|| self.voices.iter().position(|v| !v.is_active()))
            .unwrap_or_else(|| self.steal());
        let fresh = !self.voices[index].is_active();
        let phases = [
            self.random_phase(),
            self.random_phase(),
            self.random_phase(),
        ];

        let voice = &mut self.voices[index];
        if fresh {
            voice.phases = phases;
            voice.sub_phase = 0.0;
            voice.filters = [[Svf::ZERO; 2]; 2];
        }
        voice.channel = channel;
        voice.key = key;
        voice.note_id = event.note_id().into_specific();
        voice.age = self.clock;
        voice.velocity = velocity;
        voice.frequency = 440.0 * ((key as f32 - 69.0) / 12.0).exp2();
        voice.amp.gate_on();
        voice.filter_env.gate_on();
    }

    /// The quietest releasing voice, else the oldest one.
    fn steal(&self) -> usize {
        let releasing = self
            .voices
            .iter()
            .enumerate()
            .filter(|(_, v)| v.amp.is_releasing())
            .min_by(|(_, a), (_, b)| a.amp.value().total_cmp(&b.amp.value()))
            .map(|(index, _)| index);
        releasing.unwrap_or_else(|| {
            self.voices
                .iter()
                .enumerate()
                .min_by_key(|(_, v)| v.age)
                .map(|(index, _)| index)
                .unwrap_or(0)
        })
    }

    pub fn note_off(&mut self, event: &NoteOffEvent) {
        if !event.port_index().matches(0u16) {
            return;
        }
        for voice in self.voices.iter_mut() {
            if voice.is_active() && voice.matches(event.channel(), event.key(), event.note_id()) {
                voice.amp.gate_off();
                voice.filter_env.gate_off();
            }
        }
    }

    pub fn note_choke(&mut self, event: &NoteChokeEvent) {
        if !event.port_index().matches(0u16) {
            return;
        }
        for voice in self.voices.iter_mut() {
            if voice.matches(event.channel(), event.key(), event.note_id()) {
                voice.amp.reset();
                voice.filter_env.reset();
            }
        }
    }

    fn controls(&mut self, params: &PolySynthParams, frames: usize) -> Controls {
        let sr = self.sample_rate;
        let detune = cents(params.get(DETUNE), DETUNE_CENTS);
        let spread = (params.get(DETUNE) * 6.0).min(1.0);
        let drive = params.get(DRIVE);
        let drive_gain = 1.0 + drive * 8.0;
        let vibrato = cents(params.get(VIBRATO), VIBRATO_CENTS);
        let release = seconds(params.get(RELEASE), RELEASE_MAX);
        let attack = seconds(params.get(ATTACK), ATTACK_MAX);

        // Smooth cutoff in the exponential domain to avoid zipper noise.
        let target = cutoff_hz(params.get(CUTOFF));
        self.cutoff += (target - self.cutoff) * 0.25;

        let lfo = (self.vibrato_phase * TAU).sin();
        advance(&mut self.vibrato_phase, VIBRATO_HZ * frames as f32 / sr);

        Controls {
            sample_rate: sr,
            wave: Wave::from_value(params.get(WAVE)),
            pitch: (vibrato * lfo / 1200.0).exp2(),
            detune_up: (detune / 1200.0).exp2(),
            detune_down: (-detune / 1200.0).exp2(),
            spread,
            spread_norm: 1.0 / (1.0 + 0.6 * spread),
            sub: params.get(SUB) * 0.8,
            cutoff: self.cutoff,
            resonance_k: 0.765 - 0.72 * params.get(RESONANCE),
            env_octaves: params.get(ENV_AMOUNT) * ENV_OCTAVES,
            drive_gain,
            drive_norm: 1.0 / fast_tanh(drive_gain),
            amp: EnvCoefs::new(
                attack,
                seconds(params.get(DECAY), DECAY_MAX),
                params.get(SUSTAIN),
                release,
                sr,
            ),
            filter: EnvCoefs::new(
                attack,
                seconds(params.get(ENV_DECAY), ENV_DECAY_MAX),
                0.0,
                release,
                sr,
            ),
        }
    }

    /// Renders into zero-filled buffers.
    pub fn render(&mut self, left: &mut [f32], right: &mut [f32], params: &PolySynthParams) {
        let frames = left.len().min(right.len());
        let mut start = 0;
        while start < frames {
            let end = (start + CONTROL_BLOCK).min(frames);
            let controls = self.controls(params, end - start);
            for voice in self.voices.iter_mut().filter(|v| v.is_active()) {
                voice.render(&controls, &mut left[start..end], &mut right[start..end]);
            }
            start = end;
        }

        let target = params.get(VOLUME);
        for (l, r) in left.iter_mut().zip(right.iter_mut()) {
            self.volume += (target - self.volume) * 0.002;
            let gain = self.volume * self.volume * 2.0;
            *l = fast_tanh(*l * gain);
            *r = fast_tanh(*r * gain);
        }
    }
}
