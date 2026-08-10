// File-backed campaign storage.
//
// Campaigns live in `.run/campaigns/<id>.json` — gitignored, repo-local, and outside the browser
// directory the release script swaps, so publishing a release never disturbs saved work. One file
// per campaign, written atomically. The set is bounded the same way the admin session and
// generation stores are: a hard ceiling with oldest-first eviction, never an unbounded map.

import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_CAMPAIGNS = 200;

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const DEFAULT_DIRECTORY = process.env.CAMPAIGN_DATA_DIR?.trim() || join(ROOT, '.run', 'campaigns');
const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isCampaignId(value) {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

export function createCampaignId() {
  return randomUUID();
}

export function createCampaignStore({
  directory = DEFAULT_DIRECTORY,
  maxCampaigns = MAX_CAMPAIGNS,
} = {}) {
  if (!Number.isSafeInteger(maxCampaigns) || maxCampaigns <= 0) {
    throw new TypeError('maxCampaigns must be a positive integer.');
  }

  const campaigns = new Map();
  let loading;

  function fileFor(id) {
    // Every path is built from an id that already matched the UUID pattern, so a campaign id can
    // never escape the directory.
    if (!isCampaignId(id)) {
      throw new TypeError('Invalid campaign id.');
    }
    return join(directory, `${id}.json`);
  }

  async function loadOnce() {
    loading ??= (async () => {
      await mkdir(directory, { recursive: true });
      const entries = await readdir(directory).catch(() => []);
      for (const entry of entries) {
        if (!entry.endsWith('.json') || !isCampaignId(entry.slice(0, -5))) {
          continue;
        }
        try {
          const campaign = JSON.parse(await readFile(join(directory, entry), 'utf8'));
          if (isCampaignId(campaign?.id)) {
            campaigns.set(campaign.id, campaign);
          }
        } catch {
          // A truncated or hand-edited file must not take the studio down. Skip it.
        }
      }
    })();
    await loading;
  }

  function oldestFirst() {
    return [...campaigns.values()].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  }

  async function evictBeyondCap() {
    if (campaigns.size <= maxCampaigns) {
      return;
    }
    for (const campaign of oldestFirst().slice(0, campaigns.size - maxCampaigns)) {
      campaigns.delete(campaign.id);
      await rm(fileFor(campaign.id), { force: true }).catch(() => {});
    }
  }

  async function save(campaign) {
    await loadOnce();
    const target = fileFor(campaign.id);
    const staging = `${target}.${process.pid}.tmp`;
    await writeFile(staging, JSON.stringify(campaign, undefined, 2), 'utf8');
    await rename(staging, target);
    campaigns.set(campaign.id, campaign);
    await evictBeyondCap();
    return campaign;
  }

  async function get(id) {
    if (!isCampaignId(id)) {
      return undefined;
    }
    await loadOnce();
    return campaigns.get(id);
  }

  async function list() {
    await loadOnce();
    return oldestFirst()
      .reverse()
      .map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        createdAt: campaign.createdAt,
        idea: campaign.idea,
        stage: campaign.stage,
      }));
  }

  async function remove(id) {
    if (!isCampaignId(id)) {
      return false;
    }
    await loadOnce();
    const existed = campaigns.delete(id);
    await rm(fileFor(id), { force: true }).catch(() => {});
    return existed;
  }

  return { save, get, list, remove, size: async () => (await loadOnce(), campaigns.size) };
}
