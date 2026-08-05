#!/usr/bin/env node

import { SERVER_NAME, SERVER_VERSION } from './config.js';
import { ensureGlobalCrypto } from './crypto-compat.js';

ensureGlobalCrypto();

const [{ serveStdio }, { createServer }] = await Promise.all([
  import('@modelcontextprotocol/server/stdio'),
  import('./server.js'),
]);

console.error(`${SERVER_NAME} v${SERVER_VERSION} запущен через STDIO.`);
void serveStdio(() => createServer());
