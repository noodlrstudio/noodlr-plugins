# Play node starter

A minimal Play node with shared state, theming and the space's transport.
Copy this folder, change the reverse-domain id in `src/index.ts` (for example
`com.yourname.my-node`), and build from there.

```sh
npm install
npm run dev       # preview in a browser, with a mock host
npm run validate  # type-check and test
```

`npm run dev` shows the node with the mock host context from
`@noodlrstudio/play-api`, the noodlr theme tokens and a Light / Dark switch.

To play a node inside noodlr (in the Mac app's Node Lab or a local Room), it
needs a bundle for the local plugins folder. Projects created with
[`@noodlrstudio/mcp`](../../packages/mcp)'s `scaffold_plugin` include that
build (`npm run build:local`); see
[`examples/compressor-play-node`](../compressor-play-node) for one. Loading it
needs [developer access](../../README.md#developer-access).

The Play API is at version `0`: expect breaking changes before 1.0.
