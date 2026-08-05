#!/usr/bin/env node

import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { SERVER_NAME, SERVER_VERSION } from './config.js';
import { createServer } from './server.js';

console.error(`${SERVER_NAME} v${SERVER_VERSION} запущен через STDIO.`);
void serveStdio(() => createServer());
