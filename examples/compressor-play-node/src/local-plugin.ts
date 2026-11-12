// Entry for loading this node from the Noodlr Mac app's local plugins folder
// (Developer › Load Local Plugins). The bundle carries its own Svelte runtime,
// so it mounts its own view into the element the host gives it.
import { mount, unmount } from "svelte";
import { compressor } from "./index";

const { view, ...definition } = compressor;

export default {
  definition,
  mount(target: HTMLElement, props: Record<string, unknown>) {
    const app = mount(view, { target, props: props as never });
    return { destroy: () => unmount(app) };
  },
};
