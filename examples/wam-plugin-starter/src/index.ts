import type { WamEvent } from "@webaudiomodules/api";
import { WebAudioModule } from "@webaudiomodules/sdk";

interface GainWamNode extends GainNode {
  savedGain: number;
  getState(): Promise<{ gain: number }>;
  setState(state: unknown): Promise<void>;
  scheduleEvents(...events: WamEvent[]): void;
  clearEvents(): void;
  connectEvents(): void;
  disconnectEvents(): void;
  destroy(): void;
}

function createGui(node: GainWamNode) {
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "2";
  slider.step = "0.01";
  slider.value = String(node.savedGain);
  slider.setAttribute("aria-label", "Gain");
  slider.addEventListener("input", () => {
    node.savedGain = Number(slider.value);
    node.gain.setValueAtTime(node.savedGain, node.context.currentTime);
    node.dispatchEvent(
      new CustomEvent("wam-automation", {
        detail: {
          type: "wam-automation",
          data: { id: "gain", value: node.savedGain, normalized: false },
        },
      }),
    );
  });
  return slider;
}

export default class GainWam extends WebAudioModule {
  constructor(groupId: string, audioContext: BaseAudioContext) {
    super(groupId, audioContext);
    Object.assign(this._descriptor, {
      identifier: "com.example.gain",
      name: "Example Gain",
      vendor: "Example Developer",
      version: "1.0.0",
      apiVersion: "2.0.0-alpha.6",
      isInstrument: false,
    });
  }

  async createAudioNode(initialState?: unknown): Promise<any> {
    const state = initialState as { gain?: number } | null;
    const node = this.audioContext.createGain() as GainWamNode;
    node.savedGain = typeof state?.gain === "number" ? state.gain : 1;
    node.gain.value = node.savedGain;
    Object.assign(node, {
      getState: async () => ({ gain: node.savedGain }),
      setState: async (value: unknown) => {
        const next = value as { gain?: number } | null;
        if (typeof next?.gain !== "number") return;
        node.savedGain = next.gain;
        node.gain.value = next.gain;
      },
      scheduleEvents: (...events: WamEvent[]) => {
        for (const event of events) {
          node.dispatchEvent(new CustomEvent(event.type, { detail: event }));
        }
      },
      clearEvents: () => {},
      connectEvents: () => {},
      disconnectEvents: () => {},
      destroy: () => node.disconnect(),
    });
    return node;
  }

  async initialize(state?: unknown): Promise<any> {
    this.audioNode = await this.createAudioNode(state);
    this.initialized = true;
    return this;
  }

  async createGui() {
    return createGui(this.audioNode as unknown as GainWamNode);
  }

  destroyGui(gui: Element) {
    gui.remove();
  }
}
