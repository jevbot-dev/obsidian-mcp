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
| `reveal_vault` | Reveal the revalidated registered folder in Finder; does not select the task workspace |
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

`release/obsidian-mcp-0.1.1.zip` contains only `obsidian-mcp/server.mjs`. The deterministic packaging script also emits archive SHA-256, per-file hash and catalog download metadata. The tag workflow runs tests, builds with the lockfile, attests provenance and publishes the release. Release packages are built in CI; local artifacts are used only for testing and reproducibility checks.

The product remains `obsidian` (`md.obsidian`); its macOS target uses `install.kind: bridge` and `connection.kind: mcp`. The catalog owns package hashes, Node launch template, allowed tools, readiness check and task-context policy. There is no second bridge card. The required application's download URL is `https://obsidian.md/download`.

Official interfaces: https://obsidian.md/help/cli and https://obsidian.md/help/uri.

## Chat presentation

For clients advertising Jevbot's interactive A2UI v0.9.1 catalogue (`interactive-0.1.0.json`), `list_vaults`, `search_notes`, `create_note` and `append_note` return host-rendered views. Vaults use a compact two-column table: click the name to open Obsidian through a host-validated deep link, or click the path to reveal its folder using the host’s native Finder API. Both actions work without an active model session. The table does not select the task workspace; specify it in the chat. Opening does not change that selection. The host pins folder reveal to the saved vault path and checks that the folder exists.

Search shows returned paths and available snippets; writes show the target, readback verification status and a bounded preview. Empty/failed states are explicit. At most 50 rows are shown; structured/text results stay complete. Unknown search shapes fall back to ordinary text. The model is instructed to avoid repeating lists shown in A2UI.

Templates contain host-owned components only, never HTML/scripts or executable URLs. Results declare opaque action IDs mapped to named MCP tools and exact arguments. Jevbot resolves the issuing connection and applies current access/read policy. Clients without the interactive catalogue receive ordinary results. The 0.1.1 feature requires a new compatible Jevbot client; released Jevbot 0.2.3 supports the previous read-only bridge, not these buttons.

## Release checklist

Before 1.0, use the current `0.1.x` line and increment the patch version for routine releases. Do not advance to `0.2.0` or `1.0.0` without an explicit version decision.

1. Run `npm test` and the Jevbot opt-in bridge integration test against the locally packaged archive.
2. Set `package.json` version, commit the lockfile and code, then push an immutable `v<version>` tag.
3. The **release** action tests, builds twice to check determinism, uploads an artifact, attests the zip and publishes the GitHub Release. A manual dispatch on `main` performs the same build/attestation validation without publishing.
4. Download the release assets and verify provenance: `gh attestation verify obsidian-mcp-<version>.zip -R jevbot-dev/obsidian-mcp`. Confirm its archive and `server.mjs` hashes against the metadata.
5. Update the existing Obsidian macOS target in the website's signed catalog, never add a second product. Publish the catalog only after a compatible Jevbot client is available. Subsequent bridge versions use catalog updates without a Jevbot release.

In `jevbot-website`, run `node scripts/import-bridge-release.mjs obsidian macos <version>` to verify the tag-scoped CI provenance, archive inventory and checksums before updating the existing target. Then run `yarn catalog:sign`, review the change and deploy with `yarn build:cloudflare && yarn deploy`. Jevbot 0.2.3 supports catalog v2 and obsidian-mcp 0.1.0. The 0.1.1 interactive bridge promotion must wait for a client release advertising the new interactive catalogue.

This package contains a JavaScript module, not a macOS executable or app bundle; its pipeline uses provenance and catalog-pinned hashes. Apple signing/notarization applies to **Jevbot.app and its bundled Node** and remains in `jevbot-mac-dev`'s build/finalize workflows. The bridge does not embed signing certificates or notarization credentials, and does not claim an Apple notarization ticket.

### Local mathematical Web preview

`show_trigonometry` provides an offline MCP App with a unit circle, sine/cosine curves, playback, angle, amplitude, frequency and phase controls. Jevbot embeds the packaged HTML in its existing sandbox; no Obsidian plugin, network request or note modification is needed. This is a self-contained demonstration, not a renderer for arbitrary vault HTML or note formulas. It does not claim to read or explain a specific note. The bridge must be registered with `show_trigonometry: read`.

`read_note` also automatically presents a source-linked integral-area Web view when the actual note contains the supported integral example (the integral of x over [0,1], plus y=x²). Its left-endpoint rectangles converge to 1/2 and 1/3, with playback, function selection and a subdivision slider. Other notes retain their ordinary text results. The bounded excerpt renders Markdown and inline/display LaTeX using Markdown-it (raw HTML disabled) and KaTeX MathML (trust disabled, finite expansion/size limits). Links/images remain inert; no vault scripts execute. The source button asks Jevbot to open a saved Obsidian deep link matching the returned vault and note path, without an MCP call or model turn. Successful opens show no status message; failures remain visible. This requires the matching Jevbot host update (planned 0.2.4).
