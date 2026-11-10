import { createNoodlrWebAppBridge } from "@noodlr/plugin-sdk/web-app";

let bank = 0;

export const bridge = createNoodlrWebAppBridge({
  manifest: {
    id: "xyz.noodlr.examples.web-app",
    name: "Web App Bridge Example",
    version: "1.0.0",
    ports: [
      { id: "midi-in", label: "MIDI In", type: "midi", direction: "in" },
      { id: "midi-out", label: "MIDI Out", type: "midi", direction: "out" },
    ],
    features: { runtimeControl: true, state: true },
  },
  onMidiMessage: ({ data }) => console.info("Noodlr MIDI", data),
  onRuntimeStateChange: ({ isAudible }) => {
    document.documentElement.toggleAttribute("data-muted", !isAudible);
  },
  onRestoreState: (state) => {
    if (state && typeof state === "object" && !Array.isArray(state)) {
      bank = Number(state.bank ?? 0);
    }
  },
});

export function selectBank(nextBank: number) {
  bank = nextBank;
  bridge.updateState({ bank });
}
