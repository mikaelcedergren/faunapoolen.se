import { loadFaunapoolenEnvironmentFiles } from './environment-files.js';
import { configureFaunapoolenLogging, log } from './logging.js';

configureFaunapoolenLogging('web');
try {
  loadFaunapoolenEnvironmentFiles({ role: 'web' });
  const { startFaunapoolenServer } = await import('./runtime.js');
  await startFaunapoolenServer({ entrypointUrl: import.meta.url });
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
