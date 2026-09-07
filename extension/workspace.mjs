import { sections, definitions, createProfile, createRecord, flattenProfile, completeness, mergeStores, uid } from './lib/schema.mjs';
import { isExtension, readStore, saveStore, downloadStore } from './lib/storage.mjs';
import { $, el, icon, toast, copy } from './lib/ui.mjs';
let store;
let section = 'basic';
let saveTimer;
let writes = Promise.resolve();
let revision = 0;
let dirty = false;
let pendingRevision = -1;
const profile = () => store.profiles.find(p => p.id === store.activeId);
function scheduleSave() {
  profile().updatedAt = new Date().toISOString();
  revision++;
  dirty = true;
  $('#save-state').textContent = '保存中…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 300);
  renderIdentity();
}
function persist() {
  clearTimeout(saveTimer);
  if (!dirty || pendingRevision === revision) return writes;
  const snapshot = structuredClone(store); const current = revision;
  pendingRevision = current;
  writes = writes.catch(() => {}).then(() => saveStore(snapshot));
  writes.then(() => { if (current === revision) { dirty = false; $('#save-state').textContent = '✓ 已保存到本机'; } }, () => { pendingRevision = -1; $('#save-state').textContent = '保存失败 · 请导出备份'; toast('无法保存资料，请导出备份后检查浏览器存储空间', true); });
  return writes;
}
function renderIdentity() {
  const p = profile();
  $('#identity-name').textContent = p.basic.name || '等待你的名字';
  $('#identity-position').textContent = p.basic.position || '下一站，由你定义';
  $('#avatar').textContent = p.basic.name?.slice(0,1) || '你';
  $('#identity-tags').replaceChildren(...[p.education[0]?.school, p.education[0]?.degree, p.basic.city].filter(Boolean).map(text => el('span',{text})));
  const progress = completeness(p);
  $('#completion-text').textContent = `${progress}%`;
  $('#completion-bar').style.width = `${progress}%`;
}
function renderVersions() {
  $('#profile-select').replaceChildren(...store.profiles.map(p => el('option', { value: p.id, text:p.title })));
  $('#profile-select').value = store.activeId;
  $('#profile-title').value = profile().title;
}
function renderNavigation() {
  $('#navigation').replaceChildren(...sections.map(s => el('button', { class:`nav-item ${section === s.id ? 'active' : ''}`, 'aria-current':section === s.id ? 'page' : false, onclick:() => { section = s.id; render(); } }, [icon(s.icon), el('span', {text:s.title})])));
}
function fieldControl(row, key, label, type, placeholder, index) {
  const id = `${section}-${index}-${key}`;
  const control = el(type === 'textarea' ? 'textarea' : 'input', { id, ...(type === 'textarea' ? { rows:5, maxlength:20000 } : { type, maxlength:2000 }), placeholder, autocomplete:'off' });
  control.value = row[key];
  const count = el('span', { class:'field-count', text:`${row[key].length} 字` });
  control.addEventListener('input', () => { row[key] = control.value; count.textContent = `${control.value.length} 字`; scheduleSave(); });
  const copyButton = el('button', { class:'text-button', type:'button', title:`复制${label}`, 'aria-label':`复制${label}`, onclick:() => row[key] ? copy(row[key]) : toast('填写内容后即可复制') }, [icon('copy',13)]);
  return el('div',{ class:`field ${type === 'textarea' || type === 'url' ? 'full' : ''}` }, [el('div',{class:'field-label'},[el('label',{for:id,text:label}),copyButton]),control,...(type === 'textarea' ? [count] : [])]);
}
function recordCard(row,index,repeated) {
  const title = repeated ? `${sections.find(s => s.id === section).title} ${String(index+1).padStart(2,'0')}` : section === 'basic' ? '基本资料' : '你的常用表达';
  const actions = el('div');
  if (repeated) {
    if (index > 0) actions.append(el('button',{class:'text-button',text:'上移',onclick:()=>{ const rows = profile()[section]; [rows[index-1],rows[index]] = [rows[index],rows[index-1]]; scheduleSave(); render(); }}));
    actions.append(el('button',{class:'text-button danger',text:'删除',onclick:()=>{ if (confirm('删除这条经历？其他经历会保留。')) { profile()[section].splice(index,1); scheduleSave(); render(); } }}));
  } else actions.append(el('small',{text: section === 'basic' ? '按需填写 · 留空项不会自动填入' : '保留事实，使用自己的语言'}));
  return el('section',{class:'form-card'},[
    el('div',{class:'form-card-heading'},[el('h2',{text:title}),actions]),
    el('div',{class:'field-grid'},definitions[section].map(([key,label,type,placeholder])=>fieldControl(row,key,label,type,placeholder,index))),
    ...(section === 'basic' ? [el('div',{class:'group-caption',text:'建议使用常用邮箱与手机号码，方便接收后续通知。'})] : [])
  ]);
}
function render() {
  const current = sections.find(s=>s.id===section);
  $('#section-title').replaceChildren(current.title,el('span',{class:'heading-dot',text:'.'}));
  $('#section-subtitle').textContent=current.sub;
  $('#breadcrumb-section').textContent=current.title;
  $('#chapter').textContent=`0${sections.indexOf(current)+1} / 05`;
  renderVersions(); renderNavigation(); renderIdentity();
  const data = profile()[section]; const repeated = Array.isArray(data);
  const nodes = (repeated ? data : [data]).map((row,index)=>recordCard(row,index,repeated));
  if (repeated) {
    if (!data.length) nodes.push(el('section',{class:'form-card empty-state'},[icon(current.icon,30),el('h3',{text:`还没有${current.title}`}),el('p',{text:'添加一段经历，之后就能随时填写或复制。'})]));
    nodes.push(el('button',{class:'add-record',onclick:()=>{ if(data.length>=30) return toast('每类经历最多支持 30 条',true); data.push(createRecord(section)); scheduleSave(); render(); }},[icon('plus',17),`添加${current.title}`]));
  }
  $('#editor').replaceChildren(...nodes);
}
async function init() {
  try { store = await readStore(); }
  catch(error) { $('#save-state').textContent='读取失败'; $('#editor').textContent=`无法读取已有资料：${error.message}。请保留浏览器数据，并尝试重新打开。`; return; }
  $('#save-state').textContent='✓ 已保存到本机';
  $('#preview-notice').classList.toggle('hidden',isExtension);
  $('#demo-link').href = isExtension ? 'demo.html' : '../demo/recruitment.html';
  $('#privacy-note').append(icon('shield',16),el('span',{text:'资料保存在当前浏览器，不上传服务器。备份文件含个人信息，请妥善保存。'}));
  $('#profile-select').addEventListener('change',()=>{ store.activeId=$('#profile-select').value; scheduleSave(); render(); });
  $('#profile-title').addEventListener('input',()=>{ profile().title=$('#profile-title').value.trim() || '未命名简历'; const option=[...$('#profile-select').options].find(o=>o.value===store.activeId); option.textContent=profile().title; scheduleSave(); });
  $('#new-profile').addEventListener('click',()=>{ if(store.profiles.length>=30) return toast('最多保存 30 份简历',true); const p=createProfile(`我的简历 ${store.profiles.length+1}`); store.profiles.push(p);store.activeId=p.id;section='basic';scheduleSave();render();$('#profile-title').focus();$('#profile-title').select(); });
  $('#duplicate-profile').addEventListener('click',()=>{ if(store.profiles.length>=30)return toast('最多保存 30 份简历',true);const p=structuredClone(profile());p.id=uid();p.title=`${p.title.slice(0,75)} · 副本`;store.profiles.push(p);store.activeId=p.id;scheduleSave();render();toast('已复制，可为这个版本调整内容'); });
  $('#delete-profile').addEventListener('click',()=>{ if(!confirm(`删除“${profile().title}”？建议先导出备份。`))return;store.profiles=store.profiles.filter(p=>p.id!==store.activeId);if(!store.profiles.length)store.profiles=[createProfile()];store.activeId=store.profiles[0].id;scheduleSave();render(); });
  $('#import-button').addEventListener('click',()=>$('#import-file').click());
  $('#import-file').addEventListener('change',async event=>{
    const file=event.target.files[0]; if(!file)return;
    try { if(file.size>2*1024*1024)throw new Error('文件不能超过 2 MB');const incoming=JSON.parse(await file.text());store=mergeStores(store,incoming);scheduleSave();render();await persist();toast('已导入为新版本，原有资料已保留'); }
    catch(error){toast(`导入失败：${error.message}`,true);} finally{event.target.value='';}
  });
  $('#export-button').addEventListener('click',()=>downloadStore(store));
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')persist();});
  window.addEventListener('pagehide',()=>persist());
  render();
}
init();
