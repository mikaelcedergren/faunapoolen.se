#!/usr/bin/env node

import {
  createE2EControllerEnvironment,
  runHermeticE2E,
} from '@mikaelcedergren/cx-framework/platform/e2e-runner';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hmr = process.argv[2] === '--hmr';

try {
  process.exitCode = await runHermeticE2E({
    configure(context) {
      return {
        configPath: path.join(repoRoot, hmr ? 'playwright.hmr.config.ts' : 'playwright.config.ts'),
        controller: {
          environment: createE2EControllerEnvironment({
            pathValue: context.pathValue,
            pnpmCliPath: context.pnpmCliPath,
            proxyUrl: context.proxyUrl,
            runtime: context.runtime,
          }),
          scriptPath: path.join(repoRoot, 'scripts', hmr ? 'e2e-hmr-server.mjs' : 'e2e-server.mjs'),
        },
        testDirectory: path.join(repoRoot, hmr ? 'tests/hmr' : 'e2e'),
      };
    },
    productId: 'faunapoolen',
    ...(hmr ? { playwrightArgs: process.argv.slice(3) } : {}),
    repoRoot,
  });
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
