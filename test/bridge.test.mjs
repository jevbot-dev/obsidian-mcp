import test from 'node:test';
import assert from 'node:assert/strict';
import { createBridge, parseVaults, notePath } from '../src/bridge.mjs';
function fixture() {
  const calls = [], files = new Map([['A/old.md', 'old content'], ['B/old.md', 'other vault']]);
  const run = async argv => {
    calls.push(argv);
    if (argv[0] === 'help') return 'vaults read create append';
    if (argv[0] === 'version') return '1.14.4';
    if (argv[0] === 'vaults') return 'A\t/vault/A\nB\t/vault/B';
    const vault = argv[0].slice(6), cmd = argv[1], args = Object.fromEntries(argv.slice(2).map(a => { const i = a.indexOf('='); return [a.slice(0, i), a.slice(i + 1)]; }));
    if (cmd === 'vault') return '/vault/' + vault;
    if (cmd === 'files') return [...files.keys()].filter(x => x.startsWith(vault + '/')).map(x => x.slice(2)).join('\n');
    if (cmd === 'read') { if (!files.has(vault + '/' + args.path)) throw Error('not found'); return files.get(vault + '/' + args.path); }
    if (cmd === 'create') { files.set(vault + '/' + args.path, args.content); return 'created'; }
    if (cmd === 'append') { const key = vault + '/' + args.path; files.set(key, files.get(key) + '\n' + args.content); return 'appended'; }
    if (cmd === 'search') return JSON.stringify(['old.md']);
    throw Error('unknown command');
  };
  const opened = [];
  return { bridge: createBridge({ run, open: async url => opened.push(url) }), calls, files, opened };
}
test('vaults are structured and every note operation targets its explicit vault', async () => {
  const { bridge, calls } = fixture();
  assert.equal((await bridge.list_vaults()).total, 2);
  await bridge.select_vault({ vault: 'A' });
  assert.equal((await bridge.read_note({ vault: 'B', path: 'old.md' })).content, 'other vault');
  assert.deepEqual(calls.at(-1), ['vault=B', 'read', 'path=old.md']);
  await assert.rejects(bridge.read_note({ path: 'old.md' }), /Select/);
  await assert.rejects(bridge.read_note({ vault: 'unknown', path: 'old.md' }), /no longer/);
});
test('writes read back and existing notes are never overwritten', async () => {
  const { bridge, files } = fixture();
  const created = await bridge.create_note({ vault: 'A', path: 'new.md', content: 'first\nsecond' });
  assert.equal(created.verified, true);
  const appended = await bridge.append_note({ vault: 'A', path: 'new.md', content: 'third' });
  assert.equal(appended.verified, true);
  await assert.rejects(bridge.create_note({ vault: 'A', path: 'old.md', content: 'overwrite' }), /not overwritten/);
  assert.equal(files.get('A/old.md'), 'old content');
});
test('navigation targets the app with encoded URIs and reports unverified delivery', async () => {
  const { bridge, opened } = fixture();
  const result = await bridge.open_note({ vault: 'A', path: 'folder/note #1.md' });
  assert.equal(result.verified, false);
  assert.equal(new URL(opened[0]).searchParams.get('file'), 'folder/note #1.md');
  assert.equal(new URL(opened[0]).searchParams.get('vault'), 'A');
});
test('unsafe paths, malformed vaults, and ambiguous names are rejected', () => {
  for (const path of ['../note.md', '/tmp/note.md', 'a//b.md', 'a/./b.md', 'x\\y.md', 'file.txt']) assert.throws(() => notePath(path));
  assert.throws(() => parseVaults('A\t/a\nA\t/b'));
  assert.throws(() => parseVaults('name-only'));
});
test('CLI failures surface setup guidance and mismatched target paths block writes', async () => {
  const disabled = createBridge({ run: async () => { throw Error('CLI disabled'); } });
  const status = await disabled.status(); assert.equal(status.ready, false); assert.match(status.message, /命令行接口/);
  const calls = [];
  const wrong = createBridge({ run: async argv => { calls.push(argv); return argv[0] === 'vaults' ? 'A\t/a' : '/other'; } });
  await assert.rejects(wrong.create_note({ vault: 'A', path: 'x.md', content: 'x' }), /different vault/);
  assert.equal(calls.length, 2);
});

test('reveal revalidates the vault and passes its registered path to Finder', async () => {
  const paths=[];
  const bridge=createBridge({run:async args=>args[0]==='vaults' ? 'A\t/vault/A' : '/vault/A',reveal:async path=>paths.push(path)});
  assert.equal((await bridge.reveal_vault({vault:'A'})).sent,true);
  assert.deepEqual(paths,['/vault/A']);
  await assert.rejects(bridge.reveal_vault({vault:'missing'}),/no longer/);
  assert.equal(paths.length,1);
});
