import { lstatSync, realpathSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  openFaunapoolenDatabase,
  verifyFaunapoolenDatabaseBeforeWrite,
} from '../server/src/database.ts';
import { seedDevelopmentDemo } from '../server/src/development-demo.ts';
import { inspectSocialMedia } from '../server/src/social-media.ts';

// No destination flag or environment DB_PATH: this command can only write the local owner store.
if (process.argv.length !== 2 || process.env.NODE_ENV === 'production')
  throw new Error('Run pnpm dev:seed locally without arguments.');
const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const store = resolve(root, 'data/owner-development');
const databasePath = resolve(store, 'faunapoolen.db');
for (const path of [resolve(root, 'data'), store, databasePath]) {
  const stat = lstatSync(path);
  if (
    stat.isSymbolicLink() ||
    realpathSync(path) !== path ||
    stat.uid !== process.getuid?.() ||
    (path === databasePath ? !stat.isFile() || stat.nlink !== 1 : !stat.isDirectory())
  )
    throw new Error('Demo data requires the owned, non-symlink local development store.');
}
const media = [];
for (const name of ['got5.jpeg', 'services/swim-ponds.jpg']) {
  const bytes = readFileSync(resolve(root, 'public/assets/images', name));
  media.push({ bytes, metadata: await inspectSocialMedia(bytes, name.split('/').at(-1)!) });
}
const database = openFaunapoolenDatabase({
  operationalRoot: store,
  databasePath,
  requireExisting: true,
  verifyBeforeWrite: verifyFaunapoolenDatabaseBeforeWrite,
});
try {
  console.log('Local demo data added:', seedDevelopmentDemo(database.sqlite, media));
  console.log('Existing edits preserved. Data stays in data/owner-development between restarts.');
} finally {
  database.close();
}
