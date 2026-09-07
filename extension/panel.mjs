import { flattenProfile, KEY } from './lib/schema.mjs';
import { isExtension, readStore } from './lib/storage.mjs';
import { matchField } from './lib/matcher.mjs';
import { $, el, icon, toast, copy } from './lib/ui.mjs';

let store, fields = [], target = null, focus = null, selectedKey = '', windowId;
let generation = 0, focusSequence = -1, busy = false, canUndo = false, port, closed = false;
const operation = text => { $('#operation-status').textContent = text; };
const fieldName = descriptor => descriptor?.label || descriptor?.placeholder || descriptor?.name || '未命名字段';
const matching = () => focus ? matchField(focus, fields) : { field: null, reason: '' };
const writable = () => Boolean(target && focus?.supported && focus.token && !matching().blocked);
const mayFill = () => writable() && (!focus.current?.trim() || $('#overwrite').checked) && !busy;

function ensurePort() {
  if (!isExtension || port || closed) return;
  try {
    port = chrome.runtime.connect({ name: 'jianli-panel' });
    port.onDisconnect.addListener(() => { port = null; if (!closed) setTimeout(() => { ensurePort(); bindPort(); }, 150); });
  } catch {}
}
function bindPort() { ensurePort(); try { port?.postMessage({ type: 'bind', target }); } catch {} }
function clearTarget(message, help = '') {
  target = null; focus = null; focusSequence = -1; selectedKey = ''; canUndo = false;
  $('#overwrite').checked = false; bindPort();
  $('#connection-status').textContent = message;
  $('#connection-dot').classList.remove('connected');
  $('#connection-help').textContent = help;
  $('#connection-help').classList.toggle('hidden', !help);
  render();
}
function renderCopy() {
  const match = matching();
  const candidates = new Set((match.field ? [match.field] : match.candidates || []).map(f => f.key));
  const q = $('#search').value.trim().toLowerCase();
  const matched = fields.filter(f => candidates.has(f.key));
  const remaining = fields.filter(f => !candidates.has(f.key) && `${f.display} ${f.value}`.toLowerCase().includes(q));
  const container = $('#copy-list'); container.replaceChildren();
  function appendField(field, highlighted) {
    const actions = [el('button', { class: 'copy-field', 'aria-label': `复制${field.display}`, title: '复制', onclick: () => copy(field.value) }, [icon('copy', 14)])];
    if (writable()) actions.unshift(el('button', { class: 'insert-field', text: '填入', 'aria-label': `填入${field.display}`, disabled: !mayFill(), onclick: () => fill(field.key) }));
    container.append(el('div', { class: `copy-item${highlighted ? ' matched' : ''}`, 'data-field-key': field.key, ...(highlighted ? { 'aria-current': 'true' } : {}) }, [
      el('div', {}, [
        ...(highlighted ? [el('span', { class: 'match-badge', text: match.candidates ? '候选资料 · 请选择对应经历' : match.auto ? '当前匹配' : '可能匹配 · 请核对' })] : []),
        el('small', { text: field.display }), el('div', { class: 'copy-value', text: field.value, title: field.value })
      ]), el('div', { class: 'copy-actions' }, actions)
    ]));
  }
  matched.forEach(field => appendField(field, true));
  if (matched.length && remaining.length) container.append(el('div', { class: 'copy-group-label', text: q ? '搜索结果' : '其他资料' }));
  remaining.forEach(field => appendField(field, false));
  if (!matched.length && !remaining.length) container.append(el('div', { class: 'empty-state', text: fields.length ? '没有找到匹配资料' : '还没有资料，先打开“管理资料”填写或导入。' }));
}
function render() {
  if (!store) return;
  const match = matching();
  $('#focus-label').textContent = focus ? fieldName(focus) : '点击网页中的输入框';
  let hint = '对应资料会自动高亮，在侧栏点击“填入”即可。';
  if (focus) hint = !focus.supported ? '这个控件需要手动填写，可使用快捷复制。' : match.blocked ? '此类字段请手动处理，快捷复制仍可使用。' : match.candidates ? `找到 ${match.candidates.length} 条候选，请选择对应经历。` : match.field ? `已定位到「${match.field.display}」` : `${match.reason}，也可从资料列表手动选择。`;
  $('#focus-hint').textContent = hint;
  $('#focus-card').classList.toggle('matched', Boolean(match.field || match.candidates?.length));
  $('#focus-current').textContent = focus?.current?.trim() ? `网页已有：${focus.current.slice(0, 200)}` : '';
  $('#focus-current').classList.toggle('hidden', !focus?.current?.trim());
  const source = $('#field-source');
  source.replaceChildren(el('option', { value: '', text: focus ? (match.field ? '请选择资料' : match.reason || '请选择资料') : '先点击网页输入框' }));
  for (const field of fields) source.append(el('option', { value: field.key, text: `${field.display}：${field.value.replace(/\n/g, ' ').slice(0, 40)}` }));
  source.value = selectedKey; source.disabled = !writable() || busy;
  $('#field-preview').textContent = fields.find(f => f.key === selectedKey)?.value || '选择资料后在这里预览。';
  $('#fill').disabled = !selectedKey || !mayFill();
  $('#undo').disabled = !target || !canUndo || busy;
  $('#overwrite').disabled = !writable() || busy;
  $('#profile-select').disabled = busy;
  renderCopy();
}
function acceptFocus(state) {
  if (!target || !state || state.sequence < focusSequence || state.url !== target.url) return;
  focusSequence = state.sequence;
  const changed = focus?.token !== state.descriptor?.token || (!state.descriptor?.supported && focus?.id !== state.descriptor?.id);
  focus = state.descriptor; canUndo = state.canUndo;
  if (changed) { selectedKey = matching().field?.key || ''; $('#overwrite').checked = false; operation('本机资料 · 提交由你完成'); }
  render();
  if (changed) $('.panel-main').scrollTo({ top: 0, behavior: 'instant' });
}
async function execute(bound, payload) {
  const [response] = await chrome.scripting.executeScript({
    target: { tabId: bound.tabId, documentIds: [bound.documentId] },
    func: async request => { try { return { ok: true, data: await globalThis.__jianliBridge(request) }; } catch (error) { return { ok: false, error: error.message }; } },
    args: [payload]
  });
  if (!response?.result?.ok) throw new Error(response?.result?.error || '页面已变化，请重新点击输入框');
  return response.result.data;
}
async function activeTarget(bound) {
  const [active] = await chrome.tabs.query({ active: true, windowId });
  if (!bound || target !== bound || active?.id !== bound.tabId) throw new Error('当前标签页已变化，请重新点击网页输入框');
}
async function connect() {
  const attempt = ++generation;
  clearTarget('正在连接当前网页…'); $('#connect').disabled = true;
  if (!isExtension) { clearTarget('网页预览模式', '安装扩展后，从招聘网页工具栏打开简历匣，即可使用常驻侧栏。'); $('#connect').disabled = false; return; }
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (!tab?.id || (tab.url && !/^https?:\/\//.test(tab.url))) throw new Error('请先打开招聘网站的申请表页面');
    const [injected] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    if (attempt !== generation) return;
    const bound = { tabId: tab.id, documentId: injected.documentId, watchId: crypto.randomUUID() };
    target = bound; bindPort();
    const state = await execute(bound, { action: 'watch', watchId: bound.watchId });
    if (attempt !== generation) { await execute(bound, { action: 'unwatch', watchId: bound.watchId }).catch(() => {}); return; }
    bound.url = state.url;
    $('#connection-status').textContent = new URL(state.url).hostname;
    $('#connection-dot').classList.add('connected');
    $('#connection-help').classList.add('hidden');
    acceptFocus(state);
  } catch (error) {
    if (attempt === generation) clearTarget('等待连接当前网页', '在招聘网页点击浏览器工具栏的简历匣，即可连接此页。浏览器内部页面不支持填写。');
  } finally { if (attempt === generation) $('#connect').disabled = false; }
}
async function fill(key) {
  const field = fields.find(f => f.key === key), bound = target, descriptor = focus;
  if (!field || !mayFill()) return;
  const overwrite = $('#overwrite').checked;
  busy = true; render();
  try {
    await activeTarget(bound);
    const result = await execute(bound, { action: 'fill', overwrite, items: [{ token: descriptor.token, value: field.value }] });
    if (target !== bound) return;
    canUndo = result.canUndo;
    acceptFocus(await execute(bound, { action: 'focused' }));
    const item = result.results[0];
    operation(item?.ok ? `已填入「${fieldName(descriptor)}」` : `未填入：${item?.reason || '请重试'}`);
  } catch (error) { operation(error.message); }
  finally { busy = false; render(); }
}
async function undo() {
  const bound = target; if (!bound || !canUndo || busy) return;
  busy = true; render();
  try {
    await activeTarget(bound);
    const result = await execute(bound, { action: 'undo' });
    if (target !== bound) return;
    acceptFocus(await execute(bound, { action: 'focused' }));
    operation(`已撤销 ${result.restored} 项${result.skipped ? `，保留 ${result.skipped} 项后续修改` : ''}`);
  } catch (error) { operation(error.message); }
  finally { busy = false; render(); }
}
async function refreshStore() {
  try {
    const previous = $('#profile-select').value;
    store = await readStore();
    $('#profile-select').replaceChildren(...store.profiles.map(p => el('option', { value: p.id, text: p.title })));
    $('#profile-select').value = store.profiles.some(p => p.id === previous) ? previous : store.activeId;
    refreshProfile();
  } catch (error) { operation(`资料读取失败：${error.message}`); }
}
function refreshProfile() {
  const profile = store.profiles.find(p => p.id === $('#profile-select').value);
  fields = profile ? flattenProfile(profile) : [];
  $('#field-count').textContent = `${fields.length} 项资料`;
  selectedKey = matching().field?.key || '';
  $('#overwrite').checked = false; render();
}
function selectTab(name) {
  for (const id of ['copy', 'fill']) {
    $('#'+id+'-tab').classList.toggle('active', id === name);
    $('#'+id+'-tab').setAttribute('aria-selected', String(id === name));
    $('#'+id+'-tab').tabIndex = id === name ? 0 : -1;
    $('#'+id+'-panel').classList.toggle('hidden', id !== name);
  }
}
$('#manage').addEventListener('click', () => isExtension ? chrome.runtime.openOptionsPage() : window.open('workspace.html', '_blank'));
$('#connect').addEventListener('click', connect);
$('#profile-select').addEventListener('change', refreshProfile);
$('#search').addEventListener('input', renderCopy);
$('#overwrite').addEventListener('change', render);
$('#field-source').addEventListener('change', () => { selectedKey = $('#field-source').value; render(); });
$('#fill').addEventListener('click', () => fill(selectedKey));
$('#undo').addEventListener('click', undo);
for (const name of ['copy', 'fill']) {
  const tab = $('#'+name+'-tab'); tab.addEventListener('click', () => selectTab(name));
  tab.addEventListener('keydown', event => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const other = event.key === 'Home' ? 'copy' : event.key === 'End' ? 'fill' : name === 'copy' ? 'fill' : 'copy'; selectTab(other); $('#'+other+'-tab').focus(); } });
}
if (isExtension) {
  windowId = (await chrome.windows.getCurrent()).id;
  ensurePort();
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message.type === 'jianli:activate' && !sender.tab && message.windowId === windowId) { connect(); return; }
    if (message.type === 'jianli:focus' && sender.tab?.id === target?.tabId && sender.tab?.windowId === windowId && sender.documentId === target?.documentId) acceptFocus(message.state);
  });
  chrome.tabs.onActivated.addListener(info => { if (info.windowId === windowId) connect(); });
  chrome.tabs.onUpdated.addListener((tabId, info) => {
    if (tabId !== target?.tabId) return;
    if (info.status === 'loading') { ++generation; clearTarget('页面正在加载…'); }
    else if (info.url || info.status === 'complete') connect();
  });
  // Navigation may have cleared target before the completion event arrives.
  chrome.tabs.onUpdated.addListener(async (tabId, info) => {
    if (target || info.status !== 'complete') return;
    const [active] = await chrome.tabs.query({ active: true, windowId });
    if (active?.id === tabId) connect();
  });
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes[KEY]) refreshStore(); });
  window.addEventListener('pagehide', () => { closed = true; ++generation; port?.disconnect(); });
}
await refreshStore();
await connect();
