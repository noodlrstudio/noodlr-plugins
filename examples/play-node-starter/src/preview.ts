// npm run dev: the node in a browser, with the mock host context from
// @noodlrstudio/play-api/testing, the noodlr theme tokens, and real Web Audio
// for its audio ports. For a quick look while you build. Use the Mac app's
// Node Lab (npm run build:local) to try it in noodlr itself.
import { mount } from "svelte";
import "@noodlrstudio/ui/theme.css";
import {
  createMockPlayNodeContext,
  createPlayNodeSharedDefaults,
  type PlayNodeCapability,
} from "@noodlrstudio/play-api";
import { starterNode as node } from "./index";

const ports = node.ports ?? [];
const mock = createMockPlayNodeContext(
  createPlayNodeSharedDefaults(node.state.fields),
  [...(node.manifest.capabilities ?? [])] as PlayNodeCapability[],
  { frame: { ports, size: node.manifest.preferredSize } },
);

// The mock has no audio; give its audio ports a real AudioContext. Inputs are
// gain nodes the test tone feeds; outputs go to the speakers.
const audio = new AudioContext();
const inputs = new Map<string, GainNode>();
const inputFor = (portId: string) => {
  let gain = inputs.get(portId);
  if (!gain) inputs.set(portId, (gain = audio.createGain()));
  return gain;
};
Object.assign(mock.context.audio, {
  ensureReady: async () => {
    await audio.resume();
    return audio;
  },
  context: () => audio,
  input: (portId: string) => ({ node: inputFor(portId) }),
  output: () => ({
    connect(source: AudioNode) {
      source.connect(audio.destination);
      return () => source.disconnect(audio.destination);
    },
  }),
});

const toolbar = document.getElementById("toolbar")!;
const button = (label: string, onClick: () => void) => {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = label;
  element.addEventListener("click", onClick);
  toolbar.append(element);
  return element;
};

let theme: "dark" | "light" = "dark";
button("Light / Dark", () => {
  theme = theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.noodlrTheme = theme;
  mock.setTheme(theme);
});

if (ports.some((port) => port.type === "audio" && port.direction === "in")) {
  let tone: OscillatorNode | null = null;
  const toneButton = button("Play test tone", () => {
    void audio.resume();
    if (tone) {
      tone.stop();
      tone = null;
      toneButton.textContent = "Play test tone";
      return;
    }
    tone = audio.createOscillator();
    tone.type = "sawtooth";
    tone.frequency.value = 110;
    const level = audio.createGain();
    level.gain.value = 0.3;
    tone.connect(level);
    for (const port of ports) {
      if (port.type === "audio" && port.direction === "in") {
        level.connect(inputFor(port.id));
      }
    }
    tone.start();
    toneButton.textContent = "Stop test tone";
  });
}

const note = document.createElement("span");
note.textContent = "Mock host: no board, cables or other players.";
toolbar.append(note);

// Nodes fill the frame the host gives them, so give the preview one too.
const size = node.manifest.preferredSize ?? { width: 300, height: 260 };
const target = document.getElementById("node")!;
target.style.width = `${size.width}px`;
target.style.height = `${size.height}px`;

const controller = await node.setup?.(mock.context as never);
mount(node.view, {
  target,
  props: {
    context: mock.context,
    controller,
    size,
    active: true,
    readOnly: false,
  } as never,
});
