# Play node starter

Copy this directory into a reviewed development workspace, replace the
reverse-domain ID, and add the resulting definition to Noodlr's trusted
allowlist during review.

```sh
npm install
npm run dev
npm test
npm run validate
```

There is intentionally no publishing command in API v0.

## Light and Dark

Noodlr's Play room has a Light and a Dark theme, and users switch between them
with the Sun/Moon toggle in the board header. The starter node supports both
without any theme code:

- Controls from `@noodlrstudio/ui/play-node` (`NodeSurface`, `Button`, `Knob` and the
  rest) follow the host theme automatically.
- Style your own elements with the `--noodlr-*` tokens, for example
  `color: var(--noodlr-text-secondary)`. Never write colour literals such as
  `#151518` or `rgba(...)`; they will be wrong in one of the two themes, and
  allowlist review rejects them.
- Read `context.appearance` only when you draw on a `<canvas>`, where CSS
  cannot reach.
- Use the Light/Dark toggle in Node Lab to check your node in both themes.

See "Appearance and theming" in `docs/play-api/api-reference.md` for the token
list.

## Staying in time

Every space has one shared tempo, and every client in a live room hears the
same beat at the same moment. A node that declares `transport.read` can read
it:

- `context.transport.snapshot()` reports `state`, `bpm` and `beat`. While the
  space clock is stopped, `state` is `"stopped"` and `bpm` is still the space's
  tempo.
- `context.transport.timeOfBeat(beat)` gives the time in seconds, on the
  `context.transport.now()` timebase, at which the clock reaches a beat, and
  `beatAt(seconds)` goes the other way. Both return `null` while the clock is
  stopped.
- `context.transport.schedule(callback, { quantizeBeats: 1 })` waits for the
  next beat line of the space clock rather than a grid of its own. Use
  `quantizeBeats: 4` for the next bar line.

A node that keeps time itself, such as a drum machine, declares `clock.follow`
as well and gets `context.clock`. It can start the clock, tell it when the node
is running with `clock.running(true)`, and offer a follow-the-space choice with
`clock.setFollow` and `clock.setOwnBpm`. Both are undoable edits for editors
and do nothing for commenters and viewers (check `clock.snapshot().canEdit`).
In tests, `createMockPlayNodeContext` gives you a stopped 120 BPM clock that
`setClock` drives.
