import { test } from 'node:test';
import assert from 'node:assert/strict';
import { layout, catalogId, supportsA2UI, toolResult } from '../src/presentation.mjs';

test('UI is negotiated and ordinary results remain intact', () => {
  const value = { total: 1, vaults: [{ name: '<script>unsafe</script>', path: '/Users/test/Vault' }] };
  const plain = toolResult('list_vaults', value, false);
  assert.equal(plain.content.length, 1);
  assert.equal(plain._meta, undefined);
  assert.deepEqual(plain.structuredContent, value);
  assert.equal(supportsA2UI({ clientCapabilities: { 'v0.9.1': { supportedCatalogIds: [catalogId] } } }), true);
  assert.equal(supportsA2UI({ clientCapabilities: { 'v0.9.1': { supportedCatalogIds: ['other'] } } }), false);
  const ui = toolResult('list_vaults', value, true);
  assert.deepEqual(ui.content[1].annotations.audience, ['user']);
  const data = JSON.parse(ui.content[1].resource.text)[0].updateDataModel.value;
  assert.equal(data.items[0].name, value.vaults[0].name);
  assert.equal(ui._meta.ui.resourceUri, 'a2ui://obsidian/vaults');
});

test('search UI is bounded, handles empty results and falls back for unknown shapes', () => {
  const results = Array.from({ length: 100 }, (_, i) => ({ path: `Folder/Note ${i}.md`, snippet: 'x'.repeat(900) }));
  const data = JSON.parse(toolResult('search_notes', { vault: 'Research', results }, true).content[1].resource.text)[0].updateDataModel.value;
  assert.equal(data.items.length, 50);
  assert.equal(data.items[0].name, 'Note 0');
  assert.equal(data.items[0].snippet.length, 501);
  assert.match(data.footer, /50/);
  const empty = JSON.parse(toolResult('search_notes', { vault: 'Research', results: [] }, true).content[1].resource.text)[0].updateDataModel.value;
  assert.match(empty.footer, /没有/);
  assert.equal(toolResult('search_notes', { vault: 'Research', results: { unexpected: true } }, true)._meta, undefined);
});

test('write result never disguises failed verification, and truncates only the UI', () => {
  for (const verified of [true, false]) {
    const value = { vault: 'Work', path: 'Note.md', verified, content: 'x'.repeat(5000) };
    const result = toolResult('append_note', value, true);
    const data = JSON.parse(result.content[1].resource.text)[0].updateDataModel.value;
    assert.match(data.result, verified ? /已读回验证/ : /未通过/);
    assert.equal(data.preview.length, 2001);
    assert.equal(result.structuredContent.content.length, 5000);
  }
  assert.equal(toolResult('open_vault', { sent: true, verified: false }, true)._meta, undefined);
});

test('all templates use fixed host components and matching surfaces with declarative actions', () => {
  for (const view of ['vaults', 'search', 'write']) {
    const messages = layout(view);
    assert.equal(messages[0].createSurface.catalogId, catalogId);
    assert.equal(messages[0].createSurface.surfaceId, messages[1].updateComponents.surfaceId);
    assert.ok(messages[1].updateComponents.components.every(c => ['Text', 'Card', 'Column', 'List', 'Table', 'Row', 'Button'].includes(c.component)));
    assert.ok(messages[1].updateComponents.components.some(c => c.id === 'root'));
  }
});

test('vault actions use exact names, never paths or executable URLs, and are bounded', () => {
  const name = 'a & ? " vault';
  const value = {total:60,vaults:Array.from({length:60},(_,i)=>({name:i ? `Vault ${i}` : name,path:'/vault/'+i}))};
  const result = toolResult('list_vaults',value,true);
  assert.equal(result._meta.ui.actions.length,0);
  const table = layout('vaults')[1].updateComponents.components.find(c=>c.component==='Table');
  assert.deepEqual(table.columns,['Vault','路径']);
  assert.ok(!layout('vaults')[1].updateComponents.components.some(c=>c.id==='select'));
  assert.equal(result._meta.ui.links.length,100);
  assert.equal(result._meta.ui.links[0].url,'obsidian://open?vault='+encodeURIComponent(name));
  assert.deepEqual(result._meta.ui.links[1],{id:'reveal-0',kind:'reveal',path:'/vault/0'});
  assert.ok(layout('vaults')[1].updateComponents.components.some(c=>c.component==='Table'));
});
