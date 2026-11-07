import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const BASE_URL = 'http://localhost:3000';

function getAdminCode(): string {
  try {
    const raw = fs.readFileSync('data/db.json', 'utf8');
    const data = JSON.parse(raw);
    return data?.settings?.adminCode || 'TEST_ADMIN';
  } catch {
    return 'TEST_ADMIN';
  }
}

async function getAdminToken(): Promise<string> {
  const code = getAdminCode();
  const res = await fetch(`${BASE_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  const data = await res.json();
  return data.token;
}

test('Playoffs & Transition: verify rotation preview and playoff structure', async () => {
  const res = await fetch(`${BASE_URL}/api/season/rotation-preview`);
  assert.equal(res.status, 200);
  const data = await res.json();

  assert.ok(data.currentSeason, 'currentSeason should be defined');
  assert.ok(data.nextSeason, 'nextSeason should be defined');
  assert.ok(Array.isArray(data.relegations), 'relegations should be an array');
  assert.ok(Array.isArray(data.promotions), 'promotions should be an array');
  assert.ok(Array.isArray(data.playoffs), 'playoffs should be an array');
  assert.equal(typeof data.playoffsCreated, 'boolean');
  assert.equal(typeof data.canRotate, 'boolean');

  // Verify all 5 playoff ties definitions exist (RPL-FNL 1 & 2, FNL-Gold, Media 1 & 2)
  const tieIds = data.playoffs.map((t: any) => t.id);
  assert.ok(tieIds.includes('rpl_fnl_1'), 'Must include RPL-FNL tie 1');
  assert.ok(tieIds.includes('rpl_fnl_2'), 'Must include RPL-FNL tie 2');
  assert.ok(tieIds.includes('fnl_gold_1'), 'Must include FNL-Gold tie');
  assert.ok(tieIds.includes('media_playin_1'), 'Must include Media playin 1');
  assert.ok(tieIds.includes('media_playin_2'), 'Must include Media playin 2');

  // Total required matches = 2 + 2 + 2 + 1 + 1 = 8
  assert.equal(data.playoffsTotal, 8, 'Total playoff matches across all leagues must be 8');
});

test('Playoffs & Transition: admin can generate and run all playoff matches', async () => {
  const token = await getAdminToken();
  assert.ok(token, 'Must obtain admin token');

  // Generate playoffs
  const genRes = await fetch(`${BASE_URL}/api/admin/playoffs/generate`, {
    method: 'POST',
    headers: { 'x-token': token }
  });
  assert.equal(genRes.status, 200);
  const genData = await genRes.json();
  assert.equal(genData.ok, 1);
  assert.ok(genData.playoffs, 'Should return updated playoffs');

  // Run all playoff matches
  const runRes = await fetch(`${BASE_URL}/api/admin/playoffs/run-all`, {
    method: 'POST',
    headers: { 'x-token': token }
  });
  assert.equal(runRes.status, 200);
  const runData = await runRes.json();
  assert.equal(runData.ok, 1);

  // Check preview after running
  const prevRes = await fetch(`${BASE_URL}/api/season/rotation-preview`);
  const prevData = await prevRes.json();
  assert.equal(prevData.playoffsCreated, true);
  assert.equal(prevData.playoffsPlayed, 8, 'All 8 playoff matches must be played');
  assert.equal(prevData.playoffsAllPlayed, true);
  assert.equal(prevData.canRotate, true, 'Full season rotation should be allowed once all playoffs are played');

  // Check that every tie has a winner determined
  for (const tie of prevData.playoffs) {
    assert.equal(tie.isDone, true, `Tie ${tie.id} must be marked as done`);
    assert.ok(tie.winnerId, `Tie ${tie.id} must have a winnerId`);
    assert.ok(tie.winnerName, `Tie ${tie.id} must have a winnerName`);
    assert.ok(tie.scoreText, `Tie ${tie.id} must have scoreText`);
  }
});
