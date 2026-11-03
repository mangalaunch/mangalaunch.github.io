const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');
const vm = require('node:vm');

const root = resolve(__dirname, '..');
const read = name => readFileSync(resolve(root, name), 'utf8');
const pages = ['index.html', 'extensions.html'];
const dictionaryContext = { window: {} };
vm.runInNewContext(read('locales.js'), dictionaryContext);
const messages = dictionaryContext.window.SITE_MESSAGES;

test('both languages cover every translated element and accessible attribute', () => {
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages.ru).sort());
  for (const page of pages) {
    const html = read(page);
    assert.match(html, /<html lang="en">/);
    for (const match of html.matchAll(/data-i18n(?:-(?:aria-label|title|content))?="([^"]+)"/g)) {
      for (const lang of ['en', 'ru']) assert.ok(messages[lang][match[1]], `${page}: ${lang}/${match[1]}`);
    }
  }
});

test('every local asset, page, fragment and SVG reference resolves under a project prefix', () => {
  for (const page of pages) {
    const html = read(page);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${page}: duplicate ID`);
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const href = match[1];
      if (/^(https?:|data:|mailto:)/.test(href)) continue;
      assert.ok(!href.startsWith('/'), `${page}: root-relative URL ${href}`);
      const url = new URL(href, `https://example.github.io/project/${page}`);
      assert.ok(url.pathname.startsWith('/project/'));
      const path = resolve(root, decodeURIComponent(url.pathname.slice('/project/'.length)));
      assert.ok(existsSync(path), `${page}: missing ${href}`);
      if (url.hash && path.endsWith('.html')) {
        const target = readFileSync(path, 'utf8');
        assert.ok(target.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`), `${page}: missing fragment ${href}`);
      }
    }
  }
});

test('guide includes source, filter, authentication and signed publication contracts without app implementation details', () => {
  const guide = read('extensions.html');
  assert.doesNotMatch(guide, /\b(?:flutter|dart)\b/i);
  assert.doesNotMatch(guide, /(?:nsfw_)?ml_extensions/);
  assert.ok(guide.includes('en-starter-files') && guide.includes('ru-starter-files'));
  for (const term of ['filter-contract', 'source-example', 'authCompletion', 'maxConcurrentRequests',
    'multiSelect', 'triStateMultiSelect', 'include', 'exclude', 'extensions-index.ed25519', 'Ed25519', 'ctx.http']) {
    assert.ok(guide.includes(term), `guide missing ${term}`);
  }
  assert.match(guide, /data-locale-content="en"/);
  assert.match(guide, /data-locale-content="ru"[^>]*hidden/);
  const schema = JSON.parse(read('assets/sdk/manifest.schema.json'));
  assert.ok(schema.properties.sources);
});

test('download and social placeholders do not invent public destinations', () => {
  const html = read('index.html');
  assert.match(html, /class="social-placeholder"[^>]*disabled|disabled[^>]*class="social-placeholder"/);
  assert.doesNotMatch(html, /href="https?:\/\/(?:t\.me|telegram\.me)/);
  assert.ok(html.includes('id="sync"'));
  assert.ok(html.includes('Google Drive'));
});

function languageContext({ query = '', stored, blocked = false } = {}) {
  const url = `https://example.github.io/project/index.html${query}`;
  const saved = new Map(stored ? [['mangalaunch.site.language', stored]] : []);
  const context = {
    window: { SITE_MESSAGES: messages }, URL, URLSearchParams,
    location: new URL(url), history: { replaceState(_state, _unused, next) { context.lastUrl = String(next); } },
    localStorage: { getItem(key) { if (blocked) throw Error('blocked'); return saved.get(key); },
      setItem(key, value) { if (blocked) throw Error('blocked'); saved.set(key, value); } },
    document: { documentElement: {}, baseURI: url, getElementById() { return null; },
      querySelectorAll() { return []; }, dispatchEvent() {} },
    CustomEvent: class { constructor(type, value) { this.type = type; this.detail = value.detail; } },
  };
  vm.runInNewContext(read('i18n.js'), context);
  context.saved = saved;
  return context;
}

test('fresh visitors default to English; explicit URL wins over a remembered choice', () => {
  assert.equal(languageContext().document.documentElement.lang, 'en');
  assert.equal(languageContext({ stored: 'ru' }).document.documentElement.lang, 'ru');
  assert.equal(languageContext({ query: '?lang=en', stored: 'ru' }).document.documentElement.lang, 'en');
  assert.equal(languageContext({ query: '?lang=invalid', stored: 'ru' }).document.documentElement.lang, 'en');
});

test('language switching survives denied storage and keeps deep links in the project path', () => {
  const context = languageContext({ query: '#reader', blocked: true });
  context.window.SiteI18n.setLocale('ru');
  assert.equal(context.document.documentElement.lang, 'ru');
  assert.equal(context.window.SiteI18n.t('menu.open'), 'Открыть меню');
  assert.equal(context.lastUrl, 'https://example.github.io/project/index.html?lang=ru#reader');
  const remembered = languageContext();
  remembered.window.SiteI18n.setLocale('ru');
  assert.equal(remembered.saved.get('mangalaunch.site.language'), 'ru');
});

test('publication selects only public static files', () => {
  const workflow = read('.github/workflows/pages.yml');
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
  assert.match(workflow, /path: _site/);
  assert.ok(!workflow.includes('cp -R . '));
  for (const file of ['index.html', 'extensions.html', 'styles.css', 'main.js', 'locales.js', 'i18n.js', 'site-config.js', 'links.js', '.nojekyll']) {
    assert.ok(workflow.includes(file));
    assert.ok(existsSync(resolve(root, file)));
  }
});

test('every starter tool imports only files shipped with the public toolkit', () => {
  for (const file of ['pack_extension.mjs', 'package_format.mjs', 'sign_repository_index.mjs', 'generate-key.mjs']) {
    for (const match of read(`assets/extension-kit/tools/${file}`).matchAll(/from ['"](\.[^'"]+)['"]/g)) {
      assert.ok(existsSync(resolve(root, 'assets/extension-kit/tools', match[1])), `${file}: ${match[1]}`);
    }
  }
});

test('extension actions have separate elements and arrows in both languages', () => {
  assert.match(read('index.html'), /class="extension-actions"/);
  for (const lang of ['en', 'ru']) {
    assert.match(messages[lang]['copy.build-your-own-extension'], /<span aria-hidden="true">↗<\/span>/);
  }
});

test('public destinations are optional, validate HTTPS and preserve translated content', () => {
  const makePlaceholder = key => ({dataset: {publicLink:key}, className:'placeholder', childNodes:[{text:'content'}],
    replaceWith(link) { this.link=link; }});
  for (const value of [null, '', '/relative', 'http://example.org', 'javascript:alert(1)', 'https://user:pass@example.org', 'https://example.org/releases']) {
    const placeholder=makePlaceholder('windowsDownload');
    const context={URL, window:{SITE_LINKS:{windowsDownload:value}}, document:{
      querySelectorAll(){return [placeholder];},querySelector(){return null;},
      createElement(){return {dataset:{},append(...children){this.children=children;},querySelector(){return null;}};},
    }};
    vm.runInNewContext(read('links.js'),context);
    assert.equal(Boolean(placeholder.link), value==='https://example.org/releases', String(value));
    if(placeholder.link){assert.equal(placeholder.link.href,value);assert.equal(placeholder.link.children[0],placeholder.childNodes[0]);}
  }
  const defaults={window:{}};
  vm.runInNewContext(read('site-config.js'),defaults);
  assert.ok(Object.values(defaults.window.SITE_LINKS).every(value=>value===null));
});
