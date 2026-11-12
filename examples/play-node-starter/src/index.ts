import { definePlayNode } from "@noodlrstudio/play-api";
import StarterNode from "./StarterNode.svelte";

export const starterNode = definePlayNode({
  manifest: {
    id: "com.example.starter-node",
    name: "Starter Node",
    version: "0.1.0",
    apiVersion: "0",
    icon: "Activity",
    capabilities: ["collaboration.shared-state", "transport.read"],
    minimumSize: { width: 220, height: 160 },
    preferredSize: { width: 280, height: 200 },
  },
  state: {
    version: 1,
    fields: {
      enabled: {
        type: "boolean",
        default: true,
        scope: "shared-persisted",
      },
      level: {
        type: "number",
        integer: true,
        minimum: 0,
        maximum: 127,
        default: 96,
        scope: "shared-persisted",
        label: "Level",
      },
    },
  },
  view: StarterNode,
});
