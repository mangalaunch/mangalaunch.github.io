const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, copyFile, readFile, writeFile, readdir, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { resolve, join } = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { verify, createPublicKey, createHash } = require('node:crypto');

const kit = resolve(__dirname, '../assets/extension-kit');

test('downloaded authoring tools sign the example and its repository index without adjacent repositories', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'mangalaunch-guide-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const project = join(directory, 'my sources');
  await mkdir(join(project, 'src'), { recursive: true });
  await copyFile(join(kit, 'templates/json-api/manifest.json'), join(project, 'manifest.json'));
  await copyFile(join(kit, 'templates/json-api/src/index.mjs'), join(project, 'src/index.mjs'));
  await writeFile(join(project, 'LICENSE'), 'Fixture license; test data only.');
  const key = join(directory, 'private test key.pem');
  const output = join(directory, 'public', 'my-sources.mlsource');
  function run(name, args) {
    const result = spawnSync(process.execPath, [join(kit, 'tools', name), ...args], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.doesNotMatch(result.stdout, /BEGIN PRIVATE KEY/);
    return result;
  }
  run('generate-key.mjs', [key, 'guide-test-key']);
  const before = await readFile(key);
  const repeated = spawnSync(process.execPath, [join(kit, 'tools/generate-key.mjs'), key, 'guide-test-key'], { encoding: 'utf8' });
  assert.notEqual(repeated.status, 0, 'existing private keys must not be overwritten');
  assert.deepEqual(await readFile(key), before);
  run('pack_extension.mjs', ['--project', project, '--key', key, '--key-id', 'guide-test-key', '--output', output]);
  run('sign_repository_index.mjs', ['--repo', 'Example/My-Sources', '--serial', '1', '--tag', 'v1.0.0',
    '--package', output, '--key', key, '--output', join(directory, 'public'), '--generated-at', '2026-11-03T00:00:00Z']);
  const { verifyPackage } = await import(pathToFileURL(join(kit, 'tools/package_format.mjs')).href);
  const publicRecord = JSON.parse(await readFile(`${output}.public.json`, 'utf8'));
  const archive = await readFile(output);
  const manifest = verifyPackage(archive, Buffer.from(publicRecord.publicKey, 'base64'));
  assert.equal(manifest.extensionId, 'example.source.package');
  assert.equal(manifest.publisherKeyId, 'guide-test-key');
  const indexBytes = await readFile(join(directory, 'public/extensions-index.json'));
  const index = JSON.parse(indexBytes);
  assert.equal(index.repositoryId, 'example/my-sources');
  assert.equal(index.packages[0].sha256, createHash('sha256').update(archive).digest('hex'));
  const signature = await readFile(join(directory, 'public/extensions-index.ed25519'));
  assert.ok(verify(null, Buffer.concat([Buffer.from('MangaLaunch source repository v1\n'), indexBytes]), createPublicKey(before), signature));
  assert.deepEqual((await readdir(join(directory, 'public'))).sort(), ['extensions-index.ed25519', 'extensions-index.json',
    'my-sources.mlsource', 'my-sources.mlsource.public.json', 'my-sources.mlsource.sha256'].sort());
});
