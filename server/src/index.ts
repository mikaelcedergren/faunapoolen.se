import { loadFaunapoolenEnvironmentFiles } from './environment-files.js';

loadFaunapoolenEnvironmentFiles({ role: 'web' });

const { startFaunapoolenServer } = await import('./runtime.js');
await startFaunapoolenServer({ entrypointUrl: import.meta.url });
