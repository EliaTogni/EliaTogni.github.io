import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, htmlFiles, read, cssTokens, contrast, localRefs, hrefsInBlock } from './helpers/site.js';

test('tokens match the spec and text reaches 4.5:1', () => {
  const t = cssTokens();
  assert.deepEqual(t, { bg: '#ffffff', fg: '#161616', muted: '#6e6e6e', line: '#e6e6e6', rim: '#d1d1d6' });
  assert.ok(contrast(t.fg, t.bg) >= 4.5); assert.ok(contrast(t.muted, t.bg) >= 4.5);
});

test('always white: no dark mode, the coin and small logo have no rim ring at rest', () => {
  const css = read('assets/css/site.css');
  assert.doesNotMatch(css, /prefers-color-scheme/);
  assert.match(css, /color-scheme:\s*light;/);
  assert.doesNotMatch(css, /\.coin \.face::after/);
  assert.doesNotMatch(css, /\.top__home img\s*\{[^}]*box-shadow/);
});

test('no third-party requests', () => {
  for (const f of htmlFiles()) assert.doesNotMatch(read(f), /<(script|link|img|iframe|source)\b[^>]*\b(src|href)="(https?:)?\/\//i, f);
  const css = read('assets/css/site.css');
  assert.doesNotMatch(css, /url\(\s*['"]?(https?:)?\/\//); assert.doesNotMatch(css, /@import/);
});

test('every local reference resolves to a file', () => {
  for (const f of [...htmlFiles(), 'assets/css/site.css'])
    for (const ref of localRefs(read(f))) {
      const rel = ref === '/' ? 'index.html' : ref.endsWith('/') ? ref.slice(1) + 'index.html' : ref.slice(1);
      assert.ok(existsSync(join(ROOT, rel)), `${f} → ${ref}`);
    }
});

test('every <img> has an alt attribute', () => {
  for (const f of htmlFiles()) for (const img of read(f).match(/<img\b[^>]*>/g) ?? []) assert.match(img, /\balt="/, f);
});

test('home: title, language, tagline, nav, coin', () => {
  const h = read('index.html');
  assert.match(h, /<html lang="en">/);
  assert.match(h, /<title>Elia Togni · bonsoir_elio_t<\/title>/);
  assert.match(h, /\/\/ Faccio cose, vedo gente/);
  assert.deepEqual(hrefsInBlock(h, 'nav', 'nav'), ['/projects/', '/about/']);
  assert.match(h, /<button[^>]*id="coin"[^>]*aria-label="Flip coin, showing the drawing"/);
  assert.match(h, /<script type="module" src="\/assets\/js\/coin\.js"><\/script>/);
});

test('home: work contacts only, github first, each labelled', () => {
  const h = read('index.html');
  assert.deepEqual(hrefsInBlock(h, 'ul', 'social'), [
    'https://github.com/EliaTogni', 'https://www.linkedin.com/in/elia-togni-5145a814b',
    'mailto:elia97.togni@gmail.com']);
  const links = h.split('<ul class="social"')[1].split('</ul>')[0].match(/<a\b[^>]*>/g);
  for (const a of links) {
    assert.match(a, /aria-label="[^"]+"/);
    if (/href="https:/.test(a)) assert.match(a, /target="_blank" rel="noopener"/);
  }
});

test('subpages: titles and current page', () => {
  const p = read('projects/index.html'), a = read('about/index.html'), nf = read('404.html');
  assert.match(p, /<title>Projects · Elia Togni<\/title>/);
  assert.match(a, /<title>About · Elia Togni<\/title>/);
  assert.match(nf, /<title>Not found · Elia Togni<\/title>/);
  assert.match(p, /<a href="\/projects\/" aria-current="page">~\/projects<\/a>/);
  assert.match(a, /<a href="\/about\/" aria-current="page">~\/about<\/a>/);
  assert.match(nf, /command not found/); assert.match(nf, /href="\/"/);
});

test('projects: count, order, text-only cards, links only where public', () => {
  const h = read('projects/index.html');
  const cards = h.match(/<(a|article) class="card[^"]*"[\s\S]*?<\/\1>/g);
  assert.equal(Number(h.match(/(\d+) items/)[1]), cards.length);
  assert.deepEqual(cards.map(c => c.match(/class="card__name">([\w-]+)/)[1]),
    ['allot', 'alexandria', 'palettegram', 'multi-omics']);
  for (const c of cards) {
    assert.equal(/class="card card--text"/.test(c), !/<img/.test(c));
    assert.equal(c.startsWith('<a '), /^<a[^>]*href=/.test(c));
  }
  assert.match(h, /href="https:\/\/github\.com\/EliaTogni\/Disease-subtype-discovery-using-multi-omics-data-integration"/);
});

test('about: three sections and the résumé link', () => {
  const h = read('about/index.html');
  for (const s of ['$ whoami', '$ cat stack.txt', '$ open résumé.pdf']) assert.ok(h.includes(s), s);
  assert.ok(h.includes('Kotlin · Compose Multiplatform · Ktor · PostgreSQL · Dart · Flutter · Python · Docker'));
  assert.match(h, /href="\/assets\/Curriculum\.pdf"/);
});

test('home: the Italian tagline is marked lang="it" on the English page', () => {
  assert.match(read('index.html'), /<p class="tag" lang="it">\/\/ Faccio cose, vedo gente<\/p>/);
});

test('published JPEGs carry no EXIF metadata', () => {
  for (const f of readdirSync(join(ROOT, 'assets'), { recursive: true }).filter(n => /\.jpe?g$/i.test(n)))
    assert.ok(!readFileSync(join(ROOT, 'assets', f)).includes('Exif\0\0'), f);
});

test('coin layers keep a transparent margin so their border texels are transparent', () => {
  const rule = read('assets/css/site.css').match(/\.coin \.face, \.coin \.edge \{([^}]*)\}/)[1];
  assert.match(rule, /inset:\s*-2px/);
  assert.match(rule, /border:\s*2px solid transparent/);
  assert.match(rule, /background-clip:\s*padding-box/);
  // a later `background:` shorthand on the same elements would reset background-clip to border-box
  for (const [, body] of read('assets/css/site.css').matchAll(/\.coin \.(?:face|edge)\s*\{([^}]*)\}/g))
    assert.doesNotMatch(body, /(^|[;\s])background\s*:/);
});

test('edge discs are 1px smaller than the faces, so no grey ring shows at rest', () => {
  assert.match(read('assets/css/site.css'), /\.coin \.edge\s*\{[^}]*border-width:\s*3px/);
});
