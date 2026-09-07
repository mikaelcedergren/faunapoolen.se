import { loadFaunapoolenEnvironmentFiles } from './environment-files.js';
import { configureFaunapoolenLogging, log } from './logging.js';

configureFaunapoolenLogging('jobs');
try {
  loadFaunapoolenEnvironmentFiles({ role: 'worker' });
  const { startFaunapoolenWorker } = await import('./worker-runtime.js');
  await startFaunapoolenWorker({ entrypointUrl: import.meta.url });
} catch (error) {
  log.emit({
    event: 'process.start_failed',
    level: 'fatal',
    category: 'diagnostic',
    outcome: 'failure',
    error,
  });
  process.exitCode = 1;
}
