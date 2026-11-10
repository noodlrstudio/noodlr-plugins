//! noodlr's curated WCLAP delay: tempo-synced from the host's transport, with
//! ping-pong and dual modes, a clean or tape character, filtered feedback that
//! can run past 100 % without blowing up, freeze, ducking and width.

#![deny(unsafe_code)]

use crate::delay::Delay;
use crate::params::DelayParams;
use clack_extensions::state::PluginState;
use clack_extensions::{audio_ports::*, params::*};
use clack_plugin::events::event_types::TransportFlags;
use clack_plugin::events::spaces::CoreEventSpace;
use clack_plugin::prelude::*;

pub mod delay;
pub mod params;

pub struct DelayPlugin;

impl Plugin for DelayPlugin {
    type AudioProcessor<'a> = DelayAudioProcessor<'a>;
    type Shared<'a> = DelayPluginShared;
    type MainThread<'a> = DelayPluginMainThread<'a>;

    fn declare_extensions(builder: &mut PluginExtensions<Self>, _shared: Option<&DelayPluginShared>) {
        builder
            .register::<PluginAudioPorts>()
            .register::<PluginParams>()
            .register::<PluginState>();
    }
}

impl DefaultPluginFactory for DelayPlugin {
    fn get_descriptor() -> PluginDescriptor {
        use clack_plugin::plugin::features::*;

        PluginDescriptor::new("xyz.noodlr.wclap.clack-delay", "Clack Delay")
            .with_vendor("noodlr")
            .with_version("1.0.0")
            .with_features([AUDIO_EFFECT, DELAY, STEREO])
    }

    fn new_shared(_host: HostSharedHandle) -> Result<DelayPluginShared, PluginError> {
        Ok(DelayPluginShared {
            params: DelayParams::new(),
        })
    }

    fn new_main_thread<'a>(
        _host: HostMainThreadHandle<'a>,
        shared: &'a DelayPluginShared,
    ) -> Result<DelayPluginMainThread<'a>, PluginError> {
        Ok(DelayPluginMainThread { shared })
    }
}

pub struct DelayAudioProcessor<'a> {
    delay: Delay,
    shared: &'a DelayPluginShared,
}

impl<'a> PluginAudioProcessor<'a, DelayPluginShared, DelayPluginMainThread<'a>> for DelayAudioProcessor<'a> {
    fn activate(
        _host: HostAudioProcessorHandle<'a>,
        _main_thread: &DelayPluginMainThread,
        shared: &'a DelayPluginShared,
        audio_config: PluginAudioConfiguration,
    ) -> Result<Self, PluginError> {
        Ok(Self {
            delay: Delay::new(audio_config.sample_rate as f32, &shared.params),
            shared,
        })
    }

    fn process(&mut self, process: Process, mut audio: Audio, events: Events) -> Result<ProcessStatus, PluginError> {
        if let Some(transport) = process.transport {
            if transport.flags.contains(TransportFlags::HAS_TEMPO) {
                self.delay.set_tempo(transport.tempo);
            }
        }

        let mut port_pair = audio
            .port_pair(0)
            .ok_or(PluginError::Message("No input/output ports found"))?;
        let mut channels = port_pair
            .channels()?
            .into_f32()
            .ok_or(PluginError::Message("Expected f32 input/output"))?;

        let mut buffers = [None, None];
        for (pair, buffer) in channels.iter_mut().zip(&mut buffers) {
            *buffer = match pair {
                ChannelPair::InputOnly(_) | ChannelPair::OutputOnly(_) => None,
                ChannelPair::InPlace(samples) => Some(samples),
                ChannelPair::InputOutput(input, output) => {
                    output.copy_from_slice(input);
                    Some(output)
                }
            };
        }
        let [left, mut right] = buffers;
        let Some(left) = left else {
            return Err(PluginError::Message("Expected at least one channel"));
        };

        for batch in events.input.batch() {
            for event in batch.events() {
                self.handle_event(event);
            }
            let bounds = batch.sample_bounds();
            match right.as_deref_mut() {
                Some(right) => self.delay.render(&mut left[bounds.clone()], &mut right[bounds], &self.shared.params),
                None => {
                    // Mono host: run stereo in stack-sized chunks, fold to mono.
                    let mut scratch = [0.0f32; 256];
                    for chunk in left[bounds].chunks_mut(256) {
                        let scratch = &mut scratch[..chunk.len()];
                        scratch.copy_from_slice(chunk);
                        self.delay.render(chunk, scratch, &self.shared.params);
                        for (l, r) in chunk.iter_mut().zip(scratch.iter()) {
                            *l = 0.5 * (*l + r);
                        }
                    }
                }
            }
        }

        if self.delay.is_active() {
            Ok(ProcessStatus::Continue)
        } else {
            Ok(ProcessStatus::ContinueIfNotQuiet)
        }
    }

    fn reset(&mut self) {
        self.delay.reset();
    }
}

impl DelayAudioProcessor<'_> {
    fn handle_event(&mut self, event: &UnknownEvent) {
        match event.as_core_event() {
            Some(CoreEventSpace::ParamValue(event)) if event.pckn().matches_all() => {
                self.shared.params.handle_event(event)
            }
            Some(CoreEventSpace::Transport(event)) if event.flags.contains(TransportFlags::HAS_TEMPO) => {
                self.delay.set_tempo(event.tempo)
            }
            _ => {}
        }
    }
}

impl PluginAudioPortsImpl for DelayPluginMainThread<'_> {
    fn count(&self, _is_input: bool) -> u32 {
        1
    }

    fn get(&self, index: u32, _is_input: bool, writer: &mut AudioPortInfoWriter) {
        if index == 0 {
            writer.set(&AudioPortInfo {
                id: ClapId::new(1),
                name: b"main",
                channel_count: 2,
                flags: AudioPortFlags::IS_MAIN,
                port_type: Some(AudioPortType::STEREO),
                in_place_pair: Some(ClapId::new(1)),
            });
        }
    }
}

pub struct DelayPluginShared {
    params: DelayParams,
}

impl PluginShared<'_> for DelayPluginShared {}

pub struct DelayPluginMainThread<'a> {
    shared: &'a DelayPluginShared,
}

impl<'a> PluginMainThread<'a, DelayPluginShared> for DelayPluginMainThread<'a> {}

clack_export_entry!(SinglePluginEntry<DelayPlugin>);

/// WCLAP hosts allocate their structs (events, streams, buffers) in our
/// memory through this export. The host never frees them. Only exported in
/// the wasm build, so native tests keep the system allocator's `malloc`.
#[cfg(target_arch = "wasm32")]
#[allow(unsafe_code)]
#[unsafe(no_mangle)]
pub extern "C" fn malloc(size: usize) -> *mut u8 {
    match std::alloc::Layout::from_size_align(size.max(1), 16) {
        // SAFETY: the layout is non-zero sized.
        Ok(layout) => unsafe { std::alloc::alloc(layout) },
        Err(_) => std::ptr::null_mut(),
    }
}
