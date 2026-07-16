import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

export function loadProjectEnv(path) {
  if (existsSync(path)) {
    loadEnvFile(path);
  }
}
