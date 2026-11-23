import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../..', import.meta.url));

const SKIP = new Set(['docs', 'design', 'tests', '.superpowers', 'node_modules', '.git']);

/** Repo-relative paths of every published .html file. */
export function htmlFiles(dir = ROOT) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.isDirectory()) return SKIP.has(e.name) ? [] : htmlFiles(join(dir, e.name));
    return e.name.endsWith('.html') ? [relative(ROOT, join(dir, e.name))] : [];
  });
}

export const read = rel => readFileSync(join(ROOT, rel), 'utf8');

function customProps(block) {
  const out = {};
  for (const [, name, value] of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[name] = value.trim().toLowerCase();
  return out;
}

/** Color tokens from site.css; dark = light merged with the prefers-color-scheme: dark block. */
export function cssTokens(mode) {
  const css = read('assets/css/site.css');
  const light = customProps(css.match(/^:root\s*\{([^}]*)\}/m)[1]);
  const tokens = mode === 'dark'
    ? { ...light, ...customProps(css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/)[1]) }
    : light;
  const { bg, fg, muted, line, rim } = tokens;
  return { bg, fg, muted, line, rim };
}

function luminance(hex) {
  const [r, g, b] = hex.match(/[0-9a-f]{2}/gi).map(h => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colors. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Root-relative href/src values and CSS url()s, without ?query or #fragment. */
export function localRefs(text) {
  const refs = [
    ...[...text.matchAll(/\b(?:href|src)="(\/(?!\/)[^"]*)"/g)].map(m => m[1]),
    ...[...text.matchAll(/url\(\s*['"]?(\/(?!\/)[^'")]*)/g)].map(m => m[1]),
  ];
  return refs.map(r => r.split(/[?#]/)[0]);
}

/** Every href inside the first <tag class="className"> … </tag> block. */
export function hrefsInBlock(html, tag, className) {
  const block = html.match(new RegExp(`<${tag} class="${className}"[^>]*>([\\s\\S]*?)</${tag}>`))[1];
  return [...block.matchAll(/\bhref="([^"]*)"/g)].map(m => m[1]);
}
