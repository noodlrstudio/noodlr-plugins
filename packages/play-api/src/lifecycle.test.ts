import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayResourceScope } from "./lifecycle";

let queued = new Map<number, FrameRequestCallback>();
let nextId = 1;

function runFrame(time = 16) {
  const callbacks = [...queued.values()];
  queued = new Map();
  callbacks.forEach((callback) => callback(time));
}

describe("lifecycle animation frames", () => {
  beforeEach(() => {
    queued = new Map();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      const id = nextId++;
      queued.set(id, callback);
      return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => queued.delete(id));
  });
  afterEach(() => vi.unstubAllGlobals());

  function loop(lifecycle: PlayResourceScope) {
    const frames: number[] = [];
    const tick = (time: number) => {
      frames.push(time);
      lifecycle.animationFrame(tick);
    };
    lifecycle.animationFrame(tick);
    return frames;
  }

  it("runs a loop frame by frame", () => {
    const lifecycle = new PlayResourceScope();
    const frames = loop(lifecycle);
    runFrame(1);
    runFrame(2);
    expect(frames).toEqual([1, 2]);
    expect(queued.size).toBe(1);
  });

  it("holds the loop while the node is off screen", () => {
    const lifecycle = new PlayResourceScope();
    const frames = loop(lifecycle);
    runFrame(1);
    lifecycle.setVisible(false);
    expect(queued.size).toBe(0);
    runFrame(2);
    lifecycle.setVisible(true);
    runFrame(3);
    expect(frames).toEqual([1, 3]);
  });

  it("does not request a frame while hidden", () => {
    const lifecycle = new PlayResourceScope();
    lifecycle.setVisible(false);
    const callback = vi.fn();
    lifecycle.animationFrame(callback);
    expect(queued.size).toBe(0);
    lifecycle.setVisible(true);
    runFrame();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("cancels a pending frame", () => {
    const lifecycle = new PlayResourceScope();
    const callback = vi.fn();
    const cancel = lifecycle.animationFrame(callback);
    cancel();
    runFrame();
    lifecycle.setVisible(false);
    lifecycle.setVisible(true);
    runFrame();
    expect(callback).not.toHaveBeenCalled();
  });

  it("stops every frame on dispose, including held ones", async () => {
    const lifecycle = new PlayResourceScope();
    const frames = loop(lifecycle);
    lifecycle.setVisible(false);
    await lifecycle.dispose();
    lifecycle.setVisible(true);
    runFrame();
    lifecycle.animationFrame(() => frames.push(-1));
    runFrame();
    expect(frames).toEqual([]);
    expect(queued.size).toBe(0);
  });
});
