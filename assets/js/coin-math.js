// Coin flip math, free of DOM access so it can be unit tested.

/** Swipe speed (px/s) at which the coin starts to spin. */
export const TRIGGER_SPEED = 1000;
/** How far back (ms) pointer samples are kept for the speed estimate. */
export const SAMPLE_WINDOW_MS = 80;

/** @typedef {{x:number, y:number, t:number}} Sample */
/** @typedef {{showingBack:boolean, rf:number, rb:number}} CoinState  rf/rb: in-plane rotation (deg) of the front/back image */
/** @typedef {{axisDeg:number, half:number, durationMs:number, rest:CoinState, next:CoinState,
 *             hidden:{face:'front'|'back', rotationDeg:number}}} FlipPlan */

const norm180 = d => { d = ((d % 360) + 360) % 360; return d > 180 ? d - 360 : d; };

/** @returns {CoinState} */
export const initialState = () => ({ showingBack: false, rf: 0, rb: 0 });

/** @param {Sample[]} samples @param {Sample} s @returns {Sample[]} */
export function addSample(samples, s) {
  const all = [...samples, s];
  const cutoff = s.t - SAMPLE_WINDOW_MS;
  let first = 0;
  while (first < all.length - 2 && all[first].t < cutoff) first++;
  return all.slice(first);
}

/** @param {Sample[]} samples @returns {{vx:number, vy:number, speed:number}} px/s */
export function velocity(samples) {
  const p0 = samples[0], p1 = samples[samples.length - 1];
  const dt = p1.t - p0.t;
  if (dt <= 8) return { vx: 0, vy: 0, speed: 0 };
  const vx = (p1.x - p0.x) * 1000 / dt, vy = (p1.y - p0.y) * 1000 / dt;
  return { vx, vy, speed: Math.hypot(vx, vy) };
}

/** Half turns for a swipe at `ratio` × the trigger speed: always odd so the coin lands on the other face. */
export function halfTurns(ratio) {
  let half = 3 + Math.floor((ratio - 1) * 4);
  if (half % 2 === 0) half += 1;
  return Math.min(13, half);
}

export const spinDuration = half => Math.min(2200, 550 + 120 * half);

/** @param {CoinState} state @param {number} axisDeg @param {number} ratio @returns {FlipPlan} */
export function planFlip(state, axisDeg, ratio) {
  // The incoming face is hidden on the back when the spin starts. An odd half-turn about the
  // in-plane axis at angle a lands it rotated by 2a, so pre-rotate its image to cancel that.
  const half = halfTurns(ratio);
  let hidden, next;
  if (state.showingBack) {
    const rotationDeg = norm180(-(2 * axisDeg + state.rb));
    hidden = { face: 'front', rotationDeg };
    next = { showingBack: false, rf: rotationDeg, rb: state.rb };
  } else {
    const rotationDeg = norm180(-(2 * axisDeg + state.rf));
    hidden = { face: 'back', rotationDeg };
    next = { showingBack: true, rf: state.rf, rb: rotationDeg };
  }
  return { axisDeg, half, durationMs: spinDuration(half), rest: state, next, hidden };
}

/** @returns {FlipPlan | null} null when the swipe is slower than the trigger speed */
export function planSwipe(state, vx, vy) {
  const speed = Math.hypot(vx, vy);
  if (speed < TRIGGER_SPEED) return null;
  return planFlip(state, Math.atan2(vy, vx) * 180 / Math.PI, speed / TRIGGER_SPEED);
}

export const planClick = state => planFlip(state, 0, 1);

/** @param {CoinState} state */
export function restTransform(state) {
  return state.showingBack ? `rotateZ(${-state.rb}deg) rotateY(180deg)` : `rotateZ(${-state.rf}deg)`;
}

/** @param {FlipPlan} plan @param {number} elapsedMs */
export function spinTransform(plan, elapsedMs) {
  const p = Math.min(1, elapsedMs / plan.durationMs);
  const theta = plan.half * 180 * (1 - (1 - p) ** 4);
  const lift = 1 + 0.14 * Math.sin(Math.PI * Math.min(1, 1.25 * p));
  const a = plan.axisDeg;
  return {
    transform: `rotateZ(${a}deg) rotateY(${theta}deg) rotateZ(${-a}deg) ${restTransform(plan.rest)} scale(${lift})`,
    done: p >= 1,
  };
}

/** Small decaying wobble about the spin axis after landing. @param {FlipPlan} plan @param {number} sinceLandMs */
export function settleTransform(plan, sinceLandMs) {
  const s = sinceLandMs / 1000;
  if (s >= 0.9) return { transform: restTransform(plan.next), done: true };
  const w = 7 * Math.exp(-6 * s) * Math.sin(28 * s);
  const r = plan.axisDeg * Math.PI / 180;
  return { transform: `rotate3d(${-Math.sin(r)}, ${Math.cos(r)}, 0, ${w}deg) ${restTransform(plan.next)}`, done: false };
}
