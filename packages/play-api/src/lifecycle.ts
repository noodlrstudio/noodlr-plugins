import type { PlayLifecycleApi } from "./types";

type DisposeCallback = () => void | Promise<void>;

interface PendingFrame {
  callback: FrameRequestCallback;
  id: number | null;
}

export class PlayResourceScope implements PlayLifecycleApi {
  private readonly abortController = new AbortController();
  private readonly cleanupCallbacks = new Set<() => void>();
  private readonly activateCallbacks = new Set<() => void | (() => void)>();
  private readonly suspendCallbacks = new Set<() => void>();
  private readonly resizeCallbacks = new Set<
    (size: { width: number; height: number }) => void
  >();
  private readonly disposeCallbacks = new Set<DisposeCallback>();
  private activationCleanups: Array<() => void> = [];
  private readonly pendingFrames = new Set<PendingFrame>();
  private visible = true;
  private disposed = false;

  get signal() {
    return this.abortController.signal;
  }

  onActivate(callback: () => void | (() => void)) {
    this.activateCallbacks.add(callback);
    return () => this.activateCallbacks.delete(callback);
  }

  onSuspend(callback: () => void) {
    this.suspendCallbacks.add(callback);
    return () => this.suspendCallbacks.delete(callback);
  }

  onResize(callback: (size: { width: number; height: number }) => void) {
    this.resizeCallbacks.add(callback);
    return () => this.resizeCallbacks.delete(callback);
  }

  onDispose(callback: DisposeCallback) {
    this.disposeCallbacks.add(callback);
    return () => this.disposeCallbacks.delete(callback);
  }

  listen(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ) {
    target.addEventListener(type, listener, options);
    return this.track(() =>
      target.removeEventListener(type, listener, options),
    );
  }

  timeout(callback: () => void, delayMs: number) {
    const id = setTimeout(callback, delayMs);
    return this.track(() => clearTimeout(id));
  }

  interval(callback: () => void, delayMs: number) {
    const id = setInterval(callback, delayMs);
    return this.track(() => clearInterval(id));
  }

  /**
   * Like requestAnimationFrame, but held while the node is off screen: a
   * drawing loop built on it stops costing anything until the node is seen
   * again, then carries on from its next frame.
   */
  animationFrame(callback: FrameRequestCallback) {
    if (typeof requestAnimationFrame === "undefined" || this.disposed) {
      return () => {};
    }
    const frame: PendingFrame = { callback, id: null };
    this.pendingFrames.add(frame);
    if (this.visible) this.requestFrame(frame);
    return () => this.cancelFrame(frame);
  }

  /** Host only: whether the node can be seen, which gates animationFrame. */
  setVisible(visible: boolean) {
    if (this.visible === visible) return;
    this.visible = visible;
    for (const frame of this.pendingFrames) {
      if (visible && frame.id === null) this.requestFrame(frame);
      else if (!visible && frame.id !== null) {
        cancelAnimationFrame(frame.id);
        frame.id = null;
      }
    }
  }

  private requestFrame(frame: PendingFrame) {
    frame.id = requestAnimationFrame((time) => {
      frame.id = null;
      if (this.pendingFrames.delete(frame)) frame.callback(time);
    });
  }

  private cancelFrame(frame: PendingFrame) {
    if (!this.pendingFrames.delete(frame)) return;
    if (frame.id !== null) cancelAnimationFrame(frame.id);
  }

  track(cleanup: () => void) {
    if (this.disposed) {
      cleanup();
      return () => {};
    }
    this.cleanupCallbacks.add(cleanup);
    return () => {
      if (!this.cleanupCallbacks.delete(cleanup)) return;
      cleanup();
    };
  }

  activate() {
    if (this.disposed) return;
    this.activationCleanups = [...this.activateCallbacks].flatMap(
      (callback) => {
        const cleanup = callback();
        return cleanup ? [cleanup] : [];
      },
    );
  }

  suspend() {
    this.activationCleanups.splice(0).forEach((cleanup) => cleanup());
    this.suspendCallbacks.forEach((callback) => callback());
  }

  resize(size: { width: number; height: number }) {
    this.resizeCallbacks.forEach((callback) => callback(size));
  }

  async dispose(timeoutMs = 1_000) {
    if (this.disposed) return;
    this.disposed = true;
    this.abortController.abort();
    this.suspend();
    [...this.pendingFrames].forEach((frame) => this.cancelFrame(frame));
    this.cleanupCallbacks.forEach((cleanup) => cleanup());
    this.cleanupCallbacks.clear();
    await Promise.race([
      Promise.allSettled(
        [...this.disposeCallbacks].map((callback) => callback()),
      ),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
    this.disposeCallbacks.clear();
  }
}
