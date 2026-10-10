// Read-only Jevbot A2UI: presentation data never becomes an executable action.
export const catalogId = 'https://jevbot.dev/a2ui/catalogs/read-only-0.1.0.json';
const mimeType = 'application/a2ui+json';
const version = 'v0.9.1';
export const views = {
  list_vaults: 'vaults', search_notes: 'search', create_note: 'write', append_note: 'write',
};
const message = (operation, value) => ({ version, [operation]: value });
const text = (id, path, variant = 'body') => ({ id, component: 'Text', text: { path }, variant });
export function layout(view) {
  if (!Object.values(views).includes(view)) throw Error('Unknown view');
  const surfaceId = `obsidian-${view}`;
  const components = [
    { id: 'root', component: 'Card', child: 'body' },
    { id: 'body', component: 'Column', children: ['title', 'context', ...(view === 'write' ? ['result', 'preview'] : ['items']), 'footer'] },
    text('title', '/title', 'h2'), text('context', '/context', 'caption'), text('footer', '/footer', 'caption'),
  ];
  if (view === 'write') components.push(text('result', '/result'), text('preview', '/preview'));
  else components.push(
    { id: 'items', component: 'List', children: { path: '/items', componentId: 'item' } },
    { id: 'item', component: 'Column', children: ['name', 'path', 'snippet'] },
    text('name', 'name', 'h2'), text('path', 'path', 'caption'), text('snippet', 'snippet'),
  );
  return [message('createSurface', { surfaceId, catalogId }), message('updateComponents', { surfaceId, components })];
}
function clipped(value, max = 500) {
  const s = typeof value === 'string' ? value : '';
  return s.length > max ? s.slice(0, max) + '…' : s;
}
function searchItems(results) {
  // CLI versions may return file paths or objects. Unknown shapes keep the text fallback.
  const rows = Array.isArray(results) ? results : results?.results ?? results?.files;
  if (!Array.isArray(rows) || rows.some(row => typeof row !== 'string' && (!row || typeof row !== 'object' || typeof row.path !== 'string'))) return null;
  return rows;
}
export function presentationData(tool, value) {
  if (tool === 'list_vaults') {
    const rows = value.vaults;
    return { title: 'Obsidian 笔记仓库', context: `共 ${value.total} 个 vault`,
      items: rows.slice(0, 50).map(row => ({ name: clipped(row.name, 1024), path: clipped(row.path, 4096), snippet: '' })),
      footer: rows.length > 50 ? `仅展示前 50 个；另有 ${rows.length - 50} 个。请在聊天中指定 vault。` : rows.length ? '请在聊天中指定要使用的 vault。' : '尚未发现已登记的 vault。' };
  }
  if (tool === 'search_notes') {
    const rows = searchItems(value.results);
    if (!rows) return null;
    return { title: '笔记搜索结果', context: `Vault：${value.vault} · 本次返回 ${rows.length} 项`,
      items: rows.slice(0, 50).map(row => {
        const path = typeof row === 'string' ? row : row.path;
        return { name: clipped(typeof row === 'object' && row.title || path.split('/').at(-1).replace(/\.md$/i, ''), 1024),
          path: clipped(path, 4096), snippet: clipped(typeof row === 'object' ? row.snippet ?? row.content : '') };
      }), footer: rows.length > 50 ? `仅展示前 50 项；另有 ${rows.length - 50} 项。` : rows.length ? '在聊天中指定笔记即可阅读或在 Obsidian 打开。' : '本次查询没有返回匹配的笔记。' };
  }
  if (tool === 'create_note' || tool === 'append_note') return {
    title: tool === 'create_note' ? '创建笔记结果' : '追加笔记结果', context: `Vault：${value.vault} · ${value.path}`,
    result: value.verified === true ? '✓ 已读回验证' : '⚠ 读回验证未通过，请检查笔记内容。',
    preview: clipped(value.content, 2000), footer: typeof value.content === 'string' && value.content.length > 2000 ? '显示读回正文的前 2000 字符；完整正文保留在工具结果中。' : '以上为操作后读回的正文。',
  };
  return null;
}
export function supportsA2UI(capabilities) {
  return capabilities?.clientCapabilities?.[version]?.supportedCatalogIds?.includes(catalogId) === true;
}
export function toolResult(tool, value, enabled) {
  const result = { content: [{ type: 'text', text: JSON.stringify(value) }], structuredContent: value };
  if (!enabled || !views[tool]) return result;
  const data = presentationData(tool, value);
  if (!data) return result;
  const view = views[tool], uri = `a2ui://obsidian/${view}`;
  result._meta = { ui: { resourceUri: uri, mimeType } };
  result.content.push({ type: 'resource', annotations: { audience: ['user'] }, resource: {
    uri, mimeType, text: JSON.stringify([message('updateDataModel', { surfaceId: `obsidian-${view}`, path: '/', value: data })]),
  } });
  return result;
}
