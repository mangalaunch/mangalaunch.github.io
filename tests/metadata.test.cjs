const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { resolve } = require('node:path');

const root = resolve(__dirname, '..');
const origin = 'https://mangalaunch.github.io/';

function metadata(file) {
  const html = readFileSync(resolve(root, file), 'utf8');
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/)[1];
  const tags = new Map();
  for (const match of head.matchAll(/<meta\b[^>]*>/g)) {
    const attributes = Object.fromEntries([...match[0].matchAll(/([\w:-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]]));
    const key = attributes.property || attributes.name;
    if (!key) continue;
    assert.ok(!tags.has(key), `${file}: duplicate ${key}`);
    tags.set(key, attributes.content);
  }
  return { head, tags };
}

test('social crawlers receive complete static metadata for each page without running scripts', () => {
  for (const file of ['index.html', 'extensions.html', 'privacy.html', 'terms.html']) {
    const { head, tags } = metadata(file);
    const canonical = origin + (file === 'index.html' ? '' : file);
    assert.ok(head.includes(`rel="canonical" href="${canonical}"`));
    assert.equal(tags.get('og:url'), canonical);
    assert.equal(tags.get('og:type'), 'website');
    assert.equal(tags.get('og:site_name'), 'MangaLaunch');
    assert.equal(tags.get('twitter:card'), 'summary_large_image');
    assert.equal(tags.get('og:title'), tags.get('twitter:title'));
    assert.equal(tags.get('description'), tags.get('og:description'));
    assert.equal(tags.get('description'), tags.get('twitter:description'));
    assert.equal(tags.get('og:locale'), 'en_US');
    for (const key of ['og:title', 'description', 'og:image:alt', 'twitter:image:alt']) {
      assert.ok(tags.get(key)?.trim(), `${file}: missing ${key}`);
      assert.doesNotMatch(tags.get(key), /[А-Яа-яЁё]/, `${file}: initial metadata must be English`);
    }
    const imageUrl = new URL(tags.get('og:image'));
    assert.equal(imageUrl.origin + '/', origin);
    assert.equal(tags.get('og:image'), tags.get('twitter:image'));
    assert.equal(tags.get('og:image'), tags.get('og:image:secure_url'));
    const asset = resolve(root, imageUrl.pathname.slice(1));
    assert.ok(existsSync(asset), `${file}: social image must ship with the site`);
    const bytes = readFileSync(asset);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(tags.get('og:image:type'), 'image/png');
    assert.equal(Number(tags.get('og:image:width')), bytes.readUInt32BE(16));
    assert.equal(Number(tags.get('og:image:height')), bytes.readUInt32BE(20));
  }
});

test('structured data describes the real app and guide without invented prices or ratings', () => {
  for (const file of ['index.html', 'extensions.html', 'privacy.html', 'terms.html']) {
    const { head, tags } = metadata(file);
    const structured = JSON.parse(head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    assert.equal(structured['@context'], 'https://schema.org');
    assert.equal(structured['@type'], file === 'index.html' ? 'SoftwareApplication' : file === 'extensions.html' ? 'TechArticle' : 'WebPage');
    assert.equal(structured.url, tags.get('og:url'));
    assert.equal(structured.image, tags.get('og:image'));
    assert.equal(structured.description, tags.get('description'));
    assert.ok(!structured.offers && !structured.aggregateRating);
    if (file === 'index.html') {
      assert.equal(structured.name, 'MangaLaunch');
      assert.match(structured.operatingSystem, /Windows/);
      assert.match(structured.operatingSystem, /Android/);
      assert.ok(structured.featureList.some(feature => feature.includes('Google Drive')));
    }
  }
});
