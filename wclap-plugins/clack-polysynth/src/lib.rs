//! noodlr's curated WCLAP polysynth. Started from Clack's `polysynth`
//! example and rebuilt with band-limited oscillators, a resonant filter,
//! envelopes and a stereo output so it is worth playing.

#![deny(unsafe_code)]

use crate::params::PolySynthParams;
use crate::synth::Synth;
use clack_extensions::state::PluginState;
use clack_extensions::{audio_ports::*, note_ports::*, params::*};
use clack_plugin::events::spaces::CoreEventSpace;
use clack_plugin::prelude::*;

mod dsp;
mod params;
mod synth;

pub struct PolySynthPlugin;

impl Plugin for PolySynthPlugin {
    type AudioProcessor<'a> = PolySynthAudioProcessor<'a>;
    type Shared<'a> = PolySynthPluginShared;
    type MainThread<'a> = PolySynthPluginMainThread<'a>;

    fn declare_extensions(
        builder: &mut PluginExtensions<Self>,
        _shared: Option<&PolySynthPluginShared>,
    ) {
        builder
            .register::<PluginAudioPorts>()
            .register::<PluginNotePorts>()
            .register::<PluginParams>()
            .register::<PluginState>();
    }
}

impl DefaultPluginFactory for PolySynthPlugin {
    fn get_descriptor() -> PluginDescriptor {
        use clack_plugin::plugin::features::*;

        PluginDescriptor::new("xyz.noodlr.wclap.clack-polysynth", "Clack PolySynth")
            .with_vendor("noodlr")
            .with_version("2.0.0")
            .with_features([SYNTHESIZER, STEREO, INSTRUMENT])
    }

    fn new_shared(_host: HostSharedHandle) -> Result<PolySynthPluginShared, PluginError> {
        Ok(PolySynthPluginShared {
            params: PolySynthParams::new(),
        })
    }

    fn new_main_thread<'a>(
        _host: HostMainThreadHandle<'a>,
        shared: &'a PolySynthPluginShared,
    ) -> Result<PolySynthPluginMainThread<'a>, PluginError> {
        Ok(PolySynthPluginMainThread { shared })
    }
}

pub struct PolySynthAudioProcessor<'a> {
    synth: Synth,
    shared: &'a PolySynthPluginShared,
}

impl<'a> PluginAudioProcessor<'a, PolySynthPluginShared, PolySynthPluginMainThread<'a>>
    for PolySynthAudioProcessor<'a>
{
    fn activate(
        _host: HostAudioProcessorHandle<'a>,
        _main_thread: &PolySynthPluginMainThread,
        shared: &'a PolySynthPluginShared,
        audio_config: PluginAudioConfiguration,
    ) -> Result<Self, PluginError> {
        Ok(Self {
            synth: Synth::new(audio_config.sample_rate as f32, &shared.params),
            shared,
        })
    }

    fn process(
        &mut self,
        _process: Process,
        mut audio: Audio,
        events: Events,
    ) -> Result<ProcessStatus, PluginError> {
        let mut output_port = audio
            .output_port(0)
            .ok_or(PluginError::Message("No output port found"))?;
        let mut channels = output_port
            .channels()?
            .into_f32()
            .ok_or(PluginError::Message("Expected f32 output"))?;
        let count = channels.channel_count();
        if count == 0 {
            return Err(PluginError::Message("Expected at least one channel"));
        }
        for index in 0..count {
            if let Some(channel) = channels.channel_mut(index) {
                channel.fill(0.0);
            }
        }

        for batch in events.input.batch() {
            for event in batch.events() {
                self.handle_event(event);
            }
            let bounds = batch.sample_bounds();
            if count >= 2 {
                let (mut first, mut rest) = channels.split_at_mut(1);
                let (Some(left), Some(right)) = (first.channel_mut(0), rest.channel_mut(0)) else {
                    continue;
                };
                self.synth
                    .render(&mut left[bounds], &mut right[bounds], &self.shared.params);
            } else if let Some(left) = channels.channel_mut(0) {
                // Mono host: render stereo in stack-sized chunks, fold to mono.
                let left = &mut left[bounds];
                let mut right = [0.0f32; 256];
                for chunk in left.chunks_mut(256) {
                    let right = &mut right[..chunk.len()];
                    right.fill(0.0);
                    self.synth.render(chunk, right, &self.shared.params);
                    for (l, r) in chunk.iter_mut().zip(right.iter()) {
                        *l = 0.5 * (*l + r);
                    }
                }
            }
        }

        if self.synth.has_active_voices() {
            Ok(ProcessStatus::Continue)
        } else {
            Ok(ProcessStatus::Sleep)
        }
    }

    fn stop_processing(&mut self) {
        self.synth.stop_all();
    }
}

impl PolySynthAudioProcessor<'_> {
    fn handle_event(&mut self, event: &UnknownEvent) {
        match event.as_core_event() {
            Some(CoreEventSpace::NoteOn(event)) => self.synth.note_on(event),
            Some(CoreEventSpace::NoteOff(event)) => self.synth.note_off(event),
            Some(CoreEventSpace::NoteChoke(event)) => self.synth.note_choke(event),
            // Per-note param values are not supported; global ones are.
            Some(CoreEventSpace::ParamValue(event)) if event.pckn().matches_all() => {
                self.shared.params.handle_event(event)
            }
            _ => {}
        }
    }
}

impl PluginAudioPortsImpl for PolySynthPluginMainThread<'_> {
    fn count(&self, is_input: bool) -> u32 {
        if is_input { 0 } else { 1 }
    }

    fn get(&self, index: u32, is_input: bool, writer: &mut AudioPortInfoWriter) {
        if !is_input && index == 0 {
            writer.set(&AudioPortInfo {
                id: ClapId::new(1),
                name: b"main",
                channel_count: 2,
                flags: AudioPortFlags::IS_MAIN,
                port_type: Some(AudioPortType::STEREO),
                in_place_pair: None,
            });
        }
    }
}

impl PluginNotePortsImpl for PolySynthPluginMainThread<'_> {
    fn count(&self, is_input: bool) -> u32 {
        if is_input { 1 } else { 0 }
    }

    fn get(&self, index: u32, is_input: bool, writer: &mut NotePortInfoWriter) {
        if is_input && index == 0 {
            writer.set(&NotePortInfo {
                id: ClapId::new(1),
                name: b"main",
                preferred_dialect: Some(NoteDialect::Clap),
                supported_dialects: NoteDialects::CLAP,
            })
        }
    }
}

pub struct PolySynthPluginShared {
    params: PolySynthParams,
}

impl PluginShared<'_> for PolySynthPluginShared {}

pub struct PolySynthPluginMainThread<'a> {
    shared: &'a PolySynthPluginShared,
}

impl<'a> PluginMainThread<'a, PolySynthPluginShared> for PolySynthPluginMainThread<'a> {}

clack_export_entry!(SinglePluginEntry<PolySynthPlugin>);

/// WCLAP hosts allocate their structs (events, streams, buffers) in our
/// memory through this export. The host never frees them.
#[allow(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn malloc(size: usize) -> *mut u8 {
    match std::alloc::Layout::from_size_align(size.max(1), 16) {
        // SAFETY: the layout is non-zero sized.
        Ok(layout) => unsafe { std::alloc::alloc(layout) },
        Err(_) => std::ptr::null_mut(),
    }
}
