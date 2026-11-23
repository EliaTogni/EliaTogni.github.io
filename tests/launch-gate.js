import { test } from 'node:test';
import assert from 'node:assert/strict';
import { htmlFiles, read } from './helpers/site.js';

test('no placeholder or unconfirmed content is left', () => {
  for (const f of htmlFiles()) assert.doesNotMatch(read(f), /data-placeholder|data-unconfirmed|lorem ipsum/i, f);
});
