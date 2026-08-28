import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { importCampaignDirectory } from './campaign-import.js';

interface ImportArguments {
  readonly databasePath: string;
  readonly sourceDirectory: string;
}

export function parseCampaignImportArguments(arguments_: readonly string[]): ImportArguments {
  let databasePath: string | undefined;
  let sourceDirectory: string | undefined;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    const value = arguments_[index + 1];
    if (argument === '--database' && value && !value.startsWith('--') && !databasePath) {
      databasePath = path.resolve(value);
      index += 1;
      continue;
    }
    if (argument === '--source' && value && !value.startsWith('--') && !sourceDirectory) {
      sourceDirectory = path.resolve(value);
      index += 1;
      continue;
    }
    throw new Error(
      'Usage: node server/dist/import-campaigns.js --source <stopped-campaign-directory> --database <new-target>',
    );
  }
  if (!sourceDirectory || !databasePath) {
    throw new Error(
      'Campaign import requires explicit --source and --database paths; it never discovers or falls back to live data.',
    );
  }
  return Object.freeze({ databasePath, sourceDirectory });
}

export async function runCampaignImport(arguments_: readonly string[]): Promise<void> {
  const options = parseCampaignImportArguments(arguments_);
  const receipt = await importCampaignDirectory(options);
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  await runCampaignImport(process.argv.slice(2));
}
