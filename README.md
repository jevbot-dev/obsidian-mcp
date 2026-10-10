# Obsidian app bridge

A store-managed MCP component for the **Obsidian app card** in Jevbot. It does not install or replace Obsidian, touch its private database, or install an Obsidian plugin. Removing the bridge preserves the app and all notes.

Requires macOS, the Obsidian 1.12.7+ installer, and **Settings → General → Command line interface** enabled. The bridge discovers `/Applications/Obsidian.app` or `~/Applications/Obsidian.app`, validates the app and helper's vendor signatures, and runs the official `Contents/MacOS/obsidian-cli` directly. No shell, Homebrew, PATH resolution, arbitrary command or eval tool is used. Jevbot starts the bundled `server.mjs` with its own Node 24 over stdio, with privacy-permission isolation.

## User flow

Connect a model in Jevbot → open the store → Obsidian's **接入** installs this component → check `status` → if CLI is disabled, show the setup instruction and **重试接入** → when ready, **打开** returns to Jevbot chat with Obsidian selected.

The agent first lists vaults and asks which one to use (unless the user already named it). `select_vault` validates the selection. Jevbot binds it to that agent task, with `MCPAppConfig.taskContext`; note tools always explicitly target this vault. There is no process-global vault selection, so other tasks and GUI window changes do not silently redirect operations. Duplicate vault names are rejected rather than guessed.

## Tools

| Tool | Behavior |
|---|---|
| `status` | CLI readiness, setup guidance, bridge edit revision |
| `list_vaults` | Names, paths and total count |
| `select_vault` | Validate the user's target; does not open a window |
| `open_vault`, `open_note` | Send an encoded Obsidian URI with `/usr/bin/open -b md.obsidian`; report unverified delivery |
| `search_notes`, `read_note` | Structured search and note content |
| `create_note`, `append_note` | Edit and read back; report `verified` and actual content |

Read/navigation tools are annotated read-only. Edits require Jevbot approval unless its task policy admits them; these tools do not claim undo support. No delete or overwrite tool exists. `create_note` rejects existing paths and never supplies the CLI's overwrite flag. Paths must be vault-relative `.md` paths without traversal. Note content is untrusted data for the model. The edit revision tracks verified bridge writes, not arbitrary external changes in Obsidian.

## Development and distribution

```
npm ci
npm test
npm run package
```

`release/obsidian-mcp-0.1.0.zip` contains only `obsidian-mcp/server.mjs`. The deterministic packaging script also emits archive SHA-256, per-file hash and catalog download metadata. The tag workflow runs tests, builds with the lockfile, attests provenance and publishes the release. Release packages are built in CI; local artifacts are used only for testing and reproducibility checks.

The product remains `obsidian` (`md.obsidian`); its macOS target uses `install.kind: bridge` and `connection.kind: mcp`. The catalog owns package hashes, Node launch template, allowed tools, readiness check and task-context policy. There is no second bridge card. The required application's download URL is `https://obsidian.md/download`.

Official interfaces: https://obsidian.md/help/cli and https://obsidian.md/help/uri.

## Release checklist

1. Run `npm test` and the Jevbot opt-in bridge integration test against the locally packaged archive.
2. Set `package.json` version, commit the lockfile and code, then push an immutable `v<version>` tag.
3. The **release** action tests, builds twice to check determinism, uploads an artifact, attests the zip and publishes the GitHub Release. A manual dispatch on `main` performs the same build/attestation validation without publishing.
4. Download the release assets and verify provenance: `gh attestation verify obsidian-mcp-<version>.zip -R jevbot-dev/obsidian-mcp`. Confirm its archive and `server.mjs` hashes against the metadata.
5. Update the existing Obsidian macOS target in the website's signed catalog, never add a second product. Publish the catalog only after a compatible Jevbot client is available. Subsequent bridge versions use catalog updates without a Jevbot release.

In `jevbot-website`, run `node scripts/import-bridge-release.mjs obsidian macos <version>` to verify the tag-scoped CI provenance, archive inventory and checksums before updating the existing target. Then run `yarn catalog:sign`, review the change and deploy with `yarn build:cloudflare && yarn deploy`. The currently published Jevbot 0.2.2 reads catalog v1; the first v2 catalog promotion must wait for a compatible client release.

This package contains a JavaScript module, not a macOS executable or app bundle; its pipeline uses provenance and catalog-pinned hashes. Apple signing/notarization applies to **Jevbot.app and its bundled Node** and remains in `jevbot-mac-dev`'s build/finalize workflows. The bridge does not embed signing certificates or notarization credentials, and does not claim an Apple notarization ticket.
