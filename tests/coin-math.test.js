import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRIGGER_SPEED, addSample, velocity, halfTurns, spinDuration, initialState,
         planSwipe, planClick, restTransform, spinTransform, settleTransform } from '../assets/js/coin-math.js';
import { cssToMatrix, rotY, rotZ, mul, transpose, apply, maxDiff, IDENTITY } from './helpers/css-matrix.js';

test('velocity is zero when samples span 8 ms or less', () => {
  assert.equal(velocity([{ x: 0, y: 0, t: 0 }, { x: 5, y: 0, t: 5 }]).speed, 0);
});

test('velocity is first-to-last in px/s', () => {
  assert.deepEqual(velocity([{ x: 0, y: 0, t: 0 }, { x: 40, y: 0, t: 40 }, { x: 80, y: 0, t: 80 }]),
    { vx: 1000, vy: 0, speed: 1000 });
  const d = velocity([{ x: 0, y: 0, t: 0 }, { x: 60, y: -80, t: 100 }]);
  assert.equal(d.vx, 600); assert.equal(d.vy, -800); assert.equal(d.speed, 1000);
});

test('addSample keeps the last 80 ms but never fewer than 2 samples', () => {
  let s = [];
  for (let t = 0; t <= 200; t += 10) s = addSample(s, { x: t, y: 0, t });
  assert.equal(s[0].t, 120);
  assert.equal(addSample(addSample([], { x: 0, y: 0, t: 0 }), { x: 1, y: 0, t: 500 }).length, 2);
});

test('slow hover never spins: 999 px/s gives no plan, 1000 px/s spins', () => {
  assert.equal(TRIGGER_SPEED, 1000);
  assert.equal(planSwipe(initialState(), 999, 0), null);
  assert.equal(planSwipe(initialState(), 1000, 0).half, 3);
});

test('halfTurns grows with speed, is always odd, caps at 13', () => {
  assert.deepEqual([1, 1.25, 1.5, 2, 2.25, 10].map(halfTurns), [3, 5, 5, 7, 9, 13]);
});

test('spinDuration is 550 ms + 120 ms per half turn, max 2200', () => {
  assert.equal(spinDuration(3), 910);
  assert.equal(spinDuration(13), 2110);
  assert.equal(spinDuration(15), 2200);
});

test('click flips sideways to the other face: axis 0, 3 half turns, 910 ms', () => {
  const p = planClick(initialState());
  assert.deepEqual([p.axisDeg, p.half, p.durationMs, p.next.showingBack], [0, 3, 910, true]);
});

test('the axis follows the swipe direction', () => {
  assert.equal(Math.round(planSwipe(initialState(), 0, -2000).axisDeg), -90);     // upward swipe
  assert.equal(Math.round(planSwipe(initialState(), 1000, -1000).axisDeg), -45);  // bottom-left → top-right
});

test('settle ends exactly on the rest pose', () => {
  const p = planClick(initialState());
  assert.deepEqual(settleTransform(p, 900), { transform: restTransform(p.next), done: true });
});

test('2000 random flips: other face, rigid spin about a fixed axis, no jump, lands upright', () => {
  let state = initialState();
  for (let i = 0; i < 2000; i++) {
    const a = Math.random() * 2 * Math.PI, sp = 1000 + Math.random() * 9000;
    const plan = planSwipe(state, Math.cos(a) * sp, Math.sin(a) * sp);
    assert.equal(plan.next.showingBack, !state.showingBack);

    const r = plan.axisDeg * Math.PI / 180, u = [-Math.sin(r), Math.cos(r), 0];
    const restInv = transpose(cssToMatrix(restTransform(plan.rest)));
    for (const f of [0.25, 0.5, 0.75]) {           // the image never turns in its own plane
      const v = apply(cssToMatrix(spinTransform(plan, f * plan.durationMs).transform), apply(restInv, u));
      const n = Math.hypot(...v);
      assert.ok(maxDiff([v.map(x => x / n)], [u]) < 1e-3);
    }
    const end = spinTransform(plan, plan.durationMs);
    assert.equal(end.done, true);
    assert.ok(maxDiff(cssToMatrix(end.transform), cssToMatrix(restTransform(plan.next))) < 1e-3);

    state = plan.next;
    const M = cssToMatrix(restTransform(state));
    const face = state.showingBack ? mul(M, rotY(180), rotZ(state.rb)) : mul(M, rotZ(state.rf));
    assert.ok(maxDiff(face, IDENTITY) < 1e-3);
  }
});
