import { addSample, velocity, initialState, planSwipe, planClick,
         restTransform, spinTransform, settleTransform } from './coin-math.js';

const EDGE_LAYERS = 13;
const FADE_MS = 120;

const stage = document.getElementById('coin');
if (stage) {
  const coin = stage.querySelector('.coin');
  const img = { front: coin.querySelector('.front img'), back: coin.querySelector('.back img') };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // Edge discs go before the faces so a face wins over the edge disc in its own plane.
  const edges = document.createDocumentFragment();
  for (let i = 0; i < EDGE_LAYERS; i++) {
    const edge = document.createElement('span');
    edge.className = 'edge';
    edge.style.transform = `translateZ(${-3.5 + 7 * i / (EDGE_LAYERS - 1)}px)`;
    edges.append(edge);
  }
  coin.prepend(edges);

  let state = initialState();
  let samples = [];
  let spinning = false;
  let frame = 0;

  const land = plan => {
    state = plan.next;
    stage.setAttribute('aria-label', `Flip coin, showing the ${state.showingBack ? 'photo' : 'drawing'}`);
  };

  async function crossfade(plan) {
    await coin.animate({ opacity: [1, 0] }, { duration: FADE_MS, fill: 'forwards' }).finished;
    coin.style.transform = restTransform(plan.next);
    land(plan);
    await coin.animate({ opacity: [0, 1] }, { duration: FADE_MS, fill: 'forwards' }).finished;
    spinning = false;
  }

  function animate(plan) {
    const start = performance.now();
    const spin = now => {
      const { transform, done } = spinTransform(plan, Math.max(0, now - start));
      coin.style.transform = transform;
      if (!done) { frame = requestAnimationFrame(spin); return; }
      land(plan);
      spinning = false;
      const landed = now;
      const settle = t => {
        const s = settleTransform(plan, t - landed);
        coin.style.transform = s.transform;
        if (!s.done) frame = requestAnimationFrame(settle);
      };
      frame = requestAnimationFrame(settle);
    };
    frame = requestAnimationFrame(spin);
  }

  function flip(plan) {
    spinning = true;
    cancelAnimationFrame(frame);
    img[plan.hidden.face].style.transform = `rotate(${plan.hidden.rotationDeg}deg)`;
    if (reducedMotion.matches) crossfade(plan);
    else animate(plan);
  }

  stage.addEventListener('pointermove', e => {
    samples = addSample(samples, { x: e.clientX, y: e.clientY, t: e.timeStamp });
    if (spinning) return;
    const { vx, vy } = velocity(samples);
    const plan = planSwipe(state, vx, vy);
    if (plan) flip(plan);
  });
  stage.addEventListener('pointerleave', () => { samples = []; });
  stage.addEventListener('click', () => { if (!spinning) flip(planClick(state)); });
}
