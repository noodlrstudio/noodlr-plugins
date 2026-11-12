#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createNoodlrMcpServer } from "./server.js";

const server = createNoodlrMcpServer();
await server.connect(new StdioServerTransport());
