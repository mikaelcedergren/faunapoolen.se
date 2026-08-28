import { loadFaunapoolenEnvironmentFiles } from './environment-files.js';

loadFaunapoolenEnvironmentFiles({ role: 'worker' });

const { startFaunapoolenWorker } = await import('./worker-runtime.js');
await startFaunapoolenWorker({ entrypointUrl: import.meta.url });
