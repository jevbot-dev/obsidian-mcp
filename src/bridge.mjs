import { execFile } from 'node:child_process';
import { access, realpath, mkdtemp, readFile, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const APP_ID = 'md.obsidian';
const TEAM = '6JSW4SJWN9';
const SETUP = '请在 Obsidian → 设置 → 通用 → 命令行接口中启用 CLI，然后回到 Jevbot 重试接入。需要 Obsidian 1.12.7 或更新的安装器。';
const bounded = (s, max = 100000) => typeof s === 'string' && s.length > 0 && s.length <= max && !s.includes('\0');
export function notePath(path) {
  if (!bounded(path, 4096) || path.startsWith('/') || path.includes('\\') || path.split('/').some(p => !p || p === '.' || p === '..') || !path.endsWith('.md')) throw new Error('Use a vault-relative .md path, without traversal.');
  return path;
}
export function parseVaults(text) {
  const result = text.trim().split(/\r?\n/).filter(Boolean).map(line => {
    const separator = line.indexOf('\t');
    const name = line.slice(0, separator), path = line.slice(separator + 1);
    if (separator < 1 || !path.startsWith('/') || !bounded(name, 1024)) throw new Error('Obsidian returned an invalid vault list.');
    return { name, path };
  });
  if (new Set(result.map(v => v.name)).size !== result.length) throw new Error('Vault names are ambiguous. Give each vault a distinct name before connecting.');
  return result;
}

/** No PATH lookup, shell, private database access, or executable override. */
export async function nativeCLI() {
  if (process.platform !== 'darwin') throw new Error('This bridge target requires macOS.');
  for (const app of ['/Applications/Obsidian.app', join(homedir(), 'Applications/Obsidian.app')]) {
    try { await access(app); } catch { continue; }
    if (await realpath(app) !== app) throw new Error('Obsidian application path is a symbolic link.');
    const executable = join(app, 'Contents/MacOS/obsidian-cli');
    await access(executable, constants.X_OK).catch(() => { throw new Error(SETUP); });
    if (await realpath(executable) !== executable) throw new Error('Obsidian CLI path is a symbolic link.');
    const requirement = id => `=anchor apple generic and identifier "${id}" and certificate leaf[subject.OU] = "${TEAM}"`;
    const options = { timeout: 15000, maxBuffer: 256 * 1024 };
    await exec('/usr/bin/codesign', ['--verify', '--deep', '--strict', '-R', requirement(APP_ID), app], options);
    await exec('/usr/bin/codesign', ['--verify', '--strict', '-R', requirement('obsidian-cli'), executable], options);
    return executable;
  }
  throw new Error('请先安装 Obsidian：https://obsidian.md/download');
}
export async function appIcon() {
  let directory;
  try {
    const executable = await nativeCLI();
    const app = executable.slice(0, -'/Contents/MacOS/obsidian-cli'.length);
    const { stdout } = await exec('/usr/bin/defaults', ['read', join(app, 'Contents/Info'), 'CFBundleIconFile'], { timeout: 5000, maxBuffer: 4096 });
    const name = stdout.trim();
    if (!/^[A-Za-z0-9_.-]+$/.test(name)) return [];
    directory = await mkdtemp(join(tmpdir(), 'obsidian-mcp-icon-'));
    const output = join(directory, 'icon.png');
    await exec('/usr/bin/sips', ['-s', 'format', 'png', '-Z', '256', join(app, 'Contents/Resources', name.endsWith('.icns') ? name : name + '.icns'), '--out', output], { timeout: 5000, maxBuffer: 4096 });
    const data = await readFile(output);
    return [{ src: 'data:image/png;base64,' + data.toString('base64'), mimeType: 'image/png', sizes: ['256x256'] }];
  } catch { return []; }
  finally { if (directory) await rm(directory, { recursive: true, force: true }); }
}
export async function nativeRun(argv) {
  const executable = await nativeCLI();
  const { stdout } = await exec(executable, argv, { timeout: 20000, maxBuffer: 256 * 1024 });
  // Some CLI failures are printed with a successful exit code.
  if (/^(Error:|Command line interface is not enabled|CLI is not enabled)/m.test(stdout)) throw new Error(stdout.trim());
  return stdout.trimEnd();
}
export async function nativeOpen(url) {
  await nativeCLI();
  await exec('/usr/bin/open', ['-b', APP_ID, url], { timeout: 15000, maxBuffer: 64 * 1024 });
}

async function nativeReveal(path) {
  await exec('/usr/bin/open', ['-R', path], { timeout: 15000, maxBuffer: 64 * 1024 });
}

/** Every note operation explicitly targets a vault; no mutable shared selection. */
export function createBridge({ run = nativeRun, open = nativeOpen, reveal = nativeReveal } = {}) {
  let revision = 0;
  async function vaults() { return parseVaults(await run(['vaults', 'verbose'])); }
  async function target(name) {
    if (!bounded(name, 1024)) throw new Error('Select a vault first.');
    const vault = (await vaults()).find(v => v.name === name);
    if (!vault) throw new Error('This vault is no longer registered in Obsidian. List vaults and select again.');
    const path = (await run([`vault=${name}`, 'vault', 'info=path'])).trim();
    if (path !== vault.path) throw new Error('Obsidian targeted a different vault. No note operation was performed.');
    return vault;
  }
  const uri = (vault, path) => {
    const url = new URL('obsidian://open'); url.searchParams.set('vault', vault);
    if (path) url.searchParams.set('file', path);
    return url.href;
  };
  return {
    async status() {
      try {
        const help = await run(['help']);
        if (!/\bvaults\b/.test(help)) throw new Error(SETUP);
        return { ready: true, revision, message: '已接入 Obsidian。首次任务请先选择 vault。', version: (await run(['version'])).trim() };
      } catch (error) { return { ready: false, message: SETUP, detail: error.message }; }
    },
    async list_vaults() { const results = await vaults(); return { total: results.length, vaults: results }; },
    async select_vault({ vault }) { const selected = await target(vault); return { vault: selected.name, path: selected.path, selected: true }; },
    async reveal_vault({ vault }) {
      const selected = await target(vault); await reveal(selected.path);
      return { vault, path: selected.path, sent: true, verified: false };
    },
    async open_vault({ vault }) {
      await target(vault); const url = uri(vault); await open(url);
      return { vault, sent: true, verified: false, url, message: 'An open request was sent to Obsidian; displayed vault is not verified.' };
    },
    async search_notes({ vault, query, limit = 20 }) {
      await target(vault);
      if (!bounded(query, 4096) || !Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Invalid search query or limit.');
      const raw = await run([`vault=${vault}`, 'search', `query=${query}`, `limit=${limit}`, 'format=json']);
      let results; try { results = JSON.parse(raw); } catch { throw new Error('Obsidian returned invalid search JSON.'); }
      return { vault, results };
    },
    async read_note({ vault, path }) {
      await target(vault); notePath(path);
      return { vault, path, content: await run([`vault=${vault}`, 'read', `path=${path}`]) };
    },
    async create_note({ vault, path, content }) {
      await target(vault); notePath(path);
      if (!bounded(content)) throw new Error('Content must be nonempty and at most 100,000 characters.');
      const files = (await run([`vault=${vault}`, 'files'])).split(/\r?\n/);
      if (files.includes(path)) throw new Error('This note already exists. It was not overwritten.');
      await run([`vault=${vault}`, 'create', `path=${path}`, `content=${content}`]);
      const actual = await run([`vault=${vault}`, 'read', `path=${path}`]);
      const verified = actual === content.trimEnd();
      if (verified) revision++;
      return { vault, path, verified, content: actual };
    },
    async append_note({ vault, path, content }) {
      await target(vault); notePath(path);
      if (!bounded(content)) throw new Error('Content must be nonempty and at most 100,000 characters.');
      const before = await run([`vault=${vault}`, 'read', `path=${path}`]);
      await run([`vault=${vault}`, 'append', `path=${path}`, `content=${content}`]);
      const actual = await run([`vault=${vault}`, 'read', `path=${path}`]);
      const verified = actual.startsWith(before) && actual.includes(content.trimEnd(), before.length);
      if (verified) revision++;
      return { vault, path, verified, content: actual };
    },
    async open_note({ vault, path }) {
      await target(vault); notePath(path); const url = uri(vault, path); await open(url);
      return { vault, path, sent: true, verified: false, url };
    },
  };
}
