import assert from 'node:assert/strict';
import test from 'node:test';

import type { ProductManifest } from '@mikaelcedergren/cx-framework/server/product-manifest';

import { assertFaunapoolenProductManifest } from './product-contract.js';

const MANIFEST: ProductManifest = {
  $schema: './node_modules/@mikaelcedergren/cx-framework/platform/cx-product.schema.json',
  schemaVersion: 1,
  id: 'faunapoolen',
  family: 'web',
  profile: 'hybrid-site',
  deployment: 'mac-mini',
  frontend: {
    framework: 'angular',
    rendering: 'ssg',
    designSystem: 'cx-framework',
    visualSystem: 'product-skin',
  },
  capabilities: {
    authentication: 'owner',
    persistentData: 'structured-records',
    backgroundWork: 'durable',
    externalEffects: ['ai'],
  },
};

test('current Faunapoolen product manifest matches the strict runtime contract', () => {
  assert.doesNotThrow(() => assertFaunapoolenProductManifest(MANIFEST));
});

test('runtime contract rejects every capability drift', () => {
  const invalid: ProductManifest[] = [
    { ...MANIFEST, id: 'another-product' },
    { ...MANIFEST, profile: 'web-app' },
    { ...MANIFEST, frontend: { ...MANIFEST.frontend, visualSystem: 'framework' } },
    {
      ...MANIFEST,
      capabilities: { ...MANIFEST.capabilities, authentication: 'gate' },
    },
    {
      ...MANIFEST,
      capabilities: { ...MANIFEST.capabilities, persistentData: 'human-files' },
    },
    {
      ...MANIFEST,
      capabilities: { ...MANIFEST.capabilities, backgroundWork: 'none' },
    },
    {
      ...MANIFEST,
      capabilities: { ...MANIFEST.capabilities, externalEffects: ['ai', 'email'] },
    },
  ];
  for (const manifest of invalid) {
    assert.throws(() => assertFaunapoolenProductManifest(manifest), /do not match/);
  }
});
