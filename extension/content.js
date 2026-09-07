(() => {
  if (globalThis.__jianliBridge) return;
  let targets = new Map();
  const nodeTokens = new WeakMap();
  let history = [];
  let scannedUrl = '';
  let watching = false, lastFocusNode = null, sequence = 0, lastPublished = '';
  let watchController, watchedRoots = new WeakSet();
  const observers = [];
  const watchLeases = new Set();
  const norm = value => String(value || '').trim().toLowerCase().normalize('NFKC').replace(/[\s_\-()（）]/g, '');
  const valueOf = node => node.value;
  function visible(node) {
    if (!node.isConnected || node.closest('[inert], [aria-hidden="true"]')) return false;
    const win = node.ownerDocument.defaultView;
    if (!win) return false;
    const style = win.getComputedStyle(node);
    if (style.visibility === 'hidden' || style.display === 'none' || style.opacity === '0' || !node.getClientRects().length) return false;
    const root = node.getRootNode();
    if (root.host && !visible(root.host)) return false;
    if (node.ownerDocument !== document) {
      const frame = win.frameElement;
      if (!frame || !visible(frame)) return false;
    }
    return true;
  }
  function editable(node) {
    if (!node.isConnected || node.disabled || node.readOnly || node.matches(':disabled') || node.closest('[inert], [aria-hidden="true"]')) return false;
    if (node.tagName === 'INPUT' && !['text','email','tel','url','number','date','month'].includes(node.type)) return false;
    return visible(node);
  }
  function labelOf(node) {
    const root = node.getRootNode();
    const aria = (node.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean).map(id => root.getElementById?.(id)?.textContent || '').join(' ');
    const labels = [...(node.labels || [])].map(l => {
      const clone = l.cloneNode(true); clone.querySelectorAll('input,select,textarea,button').forEach(n => n.remove()); return clone.textContent;
    }).join(' ');
    return (node.getAttribute('aria-label') || aria || labels || '').trim().slice(0, 180);
  }
  function sectionOf(node) {
    const fieldset = node.closest('fieldset');
    if (fieldset) return fieldset.querySelector('legend')?.textContent.trim().slice(0,100) || '';
    for (let parent = node.parentElement, depth = 0; parent && depth < 4; parent = parent.parentElement, depth++) {
      const heading = parent.querySelector(':scope > h2, :scope > h3, :scope > h4');
      if (heading) return heading.textContent.trim().slice(0,100);
    }
    return '';
  }
  function describe(node) {
    return { label: labelOf(node), placeholder: (node.getAttribute('placeholder') || '').slice(0,180), name: node.name || '', id: node.id || '', autocomplete: node.autocomplete || '', section: sectionOf(node), type: node.type || node.tagName.toLowerCase(), current: valueOf(node), tag: node.tagName.toLowerCase() };
  }
  const identity = d => JSON.stringify([d.label,d.placeholder,d.name,d.id,d.autocomplete,d.section,d.type,d.tag]);
  function register(node) {
    const descriptor = describe(node), signature = identity(descriptor);
    let token = nodeTokens.get(node);
    const previous = targets.get(token);
    if (!previous || previous.signature !== signature || previous.url !== location.href) token = crypto.randomUUID();
    nodeTokens.set(node, token);
    targets.set(token, { node, signature, url: location.href });
    if (targets.size > 600) targets.delete(targets.keys().next().value);
    return { ...descriptor, token, supported: true };
  }
  function isField(node) { return node?.nodeType === 1 && node.matches('input, textarea, select, [contenteditable="true"], [role="combobox"]'); }
  function focusDescriptor() {
    if (!lastFocusNode?.isConnected) return null;
    const node = lastFocusNode;
    if (node.matches('input,textarea,select') && node.getAttribute('role') !== 'combobox' && editable(node)) return register(node);
    // Do not read the contents of passwords, file inputs, or unsupported controls.
    return { label: labelOf(node), placeholder: node.getAttribute('placeholder') || '', name: node.name || '', id: node.id || '', section: sectionOf(node), current: '', supported: false, type: node.type || 'custom' };
  }
  function focusState() { return { url: location.href, descriptor: focusDescriptor(), sequence, canUndo: history.length > 0 }; }
  function publish(node, force = false) {
    if (isField(node)) lastFocusNode = node;
    else if (node) lastFocusNode = null;
    const state = focusState();
    const fingerprint = JSON.stringify([state.url, state.descriptor]);
    if (!force && fingerprint === lastPublished) return;
    lastPublished = fingerprint; state.sequence = ++sequence;
    globalThis.chrome?.runtime?.sendMessage({ type: 'jianli:focus', state })?.catch(() => {});
  }
  function onFieldEvent(event) {
    const node = event.composedPath()[0];
    if ((event.type === 'input' || event.type === 'change') && node !== lastFocusNode) return;
    if (isField(node)) publish(node);
    else if (event.type === 'focusin' && node?.tagName !== 'IFRAME') publish(node);
  }
  function discover(root) {
    if (watchedRoots.has(root)) return;
    watchedRoots.add(root);
    if (root.nodeType === 9) for (const type of ['focusin', 'click', 'input', 'change']) root.addEventListener(type, onFieldEvent, { capture: true, signal: watchController.signal });
    const visit = node => {
      if (node.shadowRoot) discover(node.shadowRoot);
      if (node.tagName === 'IFRAME') {
        const attach = () => { try { if (node.contentDocument) discover(node.contentDocument); } catch {} };
        node.addEventListener('load', attach, { signal: watchController.signal }); attach();
      }
    };
    for (const node of root.querySelectorAll('*')) visit(node);
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        visit(node); for (const child of node.querySelectorAll('*')) visit(child);
      }
      if (lastFocusNode && !lastFocusNode.isConnected) { lastFocusNode = null; publish(null, true); }
    });
    observer.observe(root, { childList: true, subtree: true }); observers.push(observer);
  }
  function activeField(root) {
    let node = root.activeElement;
    try {
      if (node?.shadowRoot?.activeElement) node = activeField(node.shadowRoot);
      if (node?.tagName === 'IFRAME' && node.contentDocument) node = activeField(node.contentDocument);
    } catch {}
    return isField(node) ? node : null;
  }
  function stopWatch(watchId) {
    if (watchId) { watchLeases.delete(watchId); if (watchLeases.size) return; }
    else watchLeases.clear();
    watching = false; watchController?.abort();
    observers.splice(0).forEach(observer => observer.disconnect()); watchedRoots = new WeakSet();
  }
  function watch(watchId = 'manual') {
    watchLeases.add(watchId);
    scannedUrl = location.href;
    if (!watching) { watching = true; watchController = new AbortController(); discover(document); }
    const active = activeField(document); if (active) lastFocusNode = active;
    publish(null, true);
    return focusState();
  }
  function scan() {
    scannedUrl = location.href;
    const fields = []; let inaccessibleFrames = 0; let unsupported = 0;
    const visited = new Set();
    function walk(root) {
      if (visited.has(root)) return; visited.add(root);
      for (const node of root.querySelectorAll('*')) {
        if (node.shadowRoot) walk(node.shadowRoot);
        if (node.tagName === 'IFRAME') {
          if (!visible(node)) continue;
          try { if (node.contentDocument) walk(node.contentDocument); else inaccessibleFrames++; } catch { inaccessibleFrames++; }
        }
        if (node.matches('[role="combobox"], [contenteditable="true"], input[type="file"]') && node.getClientRects().length) unsupported++;
        if (!node.matches('input,textarea,select') || !editable(node) || fields.length >= 300) continue;
        // Custom comboboxes require their site's interaction protocol.
        if (node.getAttribute('role') === 'combobox') continue;
        fields.push(register(node));
      }
    }
    walk(document);
    return { fields, url: scannedUrl, title: document.title, inaccessibleFrames, unsupported, canUndo: history.length > 0 };
  }
  function nativeSet(node, value) {
    const win = node.ownerDocument.defaultView;
    const proto = node.tagName === 'SELECT' ? win.HTMLSelectElement.prototype : node.tagName === 'TEXTAREA' ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value);
    node.dispatchEvent(new win.Event('input', { bubbles: true, composed: true }));
    node.dispatchEvent(new win.Event('change', { bubbles: true, composed: true }));
  }
  function formatValue(node, value) {
    if (node.tagName === 'SELECT') {
      const aliases = { 男: ['male','m'], 女: ['female','f'], 硕士: ['硕士研究生','master',"master's",'masters'], 本科: ['大学本科','bachelor',"bachelor's",'bachelors'], 博士: ['博士研究生','phd','doctorate'], 大专: ['专科','大学专科'] };
      const accepted = new Set([value, ...(aliases[value] || [])].map(norm));
      const options = [...node.options].filter(o => !o.disabled && !o.parentElement?.disabled && (accepted.has(norm(o.textContent)) || norm(o.value) === norm(value)));
      if (options.length !== 1) throw new Error('下拉选项没有唯一匹配，请手动选择');
      return options[0].value;
    }
    if (node.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('网页需要完整日期，请手动补充');
    if (node.type === 'month' && /^\d{4}-\d{2}-\d{2}$/.test(value)) value = value.slice(0,7);
    if (node.maxLength > -1 && value.length > node.maxLength) throw new Error(`超出网页 ${node.maxLength} 字限制`);
    // Validate in a detached native input, before changing the live form.
    if (node.tagName === 'INPUT') {
      const probe = node.cloneNode(false); probe.value = value;
      if (probe.value !== value || !probe.checkValidity()) throw new Error('格式不符合网页要求，请手动填写');
    }
    return value;
  }
  async function fill(payload) {
    if (location.href !== scannedUrl) throw new Error('网页地址已变化，请重新识别');
    const results = []; const changes = []; const seen = new Set();
    for (const item of (payload.items || []).slice(0,300)) {
      const target = targets.get(item.token);
      try {
        if (seen.has(item.token)) continue; seen.add(item.token);
        if (typeof item.value !== 'string' || item.value.length > 20000) throw new Error('资料内容无效');
        if (!target || target.url !== location.href || !editable(target.node) || identity(describe(target.node)) !== target.signature) throw new Error('字段已变化，请重新点击输入框');
        const node = target.node;
        const before = valueOf(node);
        if (String(before).trim() && !payload.overwrite) throw new Error('保留网页已有内容');
        const desired = formatValue(node, item.value);
        if (before === desired) throw new Error('内容已经一致');
        nativeSet(node, desired);
        await new Promise(resolve => setTimeout(resolve, 25));
        if (valueOf(node) !== desired) throw new Error('网页未保留填写值，请手动完成');
        changes.push({ node, before, after: desired, signature: target.signature, url: location.href });
        results.push({ token: item.token, ok: true });
      } catch (error) { results.push({ token: item.token, ok: false, reason: error.message }); }
    }
    if (changes.length) history = changes;
    if (watching) publish(null, true);
    return { results, canUndo: history.length > 0 };
  }
  async function undo() {
    let restored = 0; let skipped = 0;
    for (const item of history) {
      if (item.url === location.href && editable(item.node) && valueOf(item.node) === item.after && identity(describe(item.node)) === item.signature) {
        nativeSet(item.node, item.before);
        await new Promise(resolve => setTimeout(resolve, 25));
        if (valueOf(item.node) === item.before) restored++; else skipped++;
      } else skipped++;
    }
    history = [];
    if (watching) publish(null, true);
    return { restored, skipped, canUndo: false };
  }
  globalThis.__jianliBridge = async payload => {
    if (payload.action === 'watch') return watch(payload.watchId);
    if (payload.action === 'unwatch') { stopWatch(payload.watchId); return { watching }; }
    if (payload.action === 'focused') return focusState();
    if (payload.action === 'scan') return scan();
    if (payload.action === 'fill') return fill(payload);
    if (payload.action === 'undo') return undo();
    throw new Error('未知操作');
  };
  globalThis.chrome?.runtime?.onMessage.addListener((message, sender) => {
    if (sender.id === chrome.runtime.id && message.type === 'jianli:stop-watch') stopWatch(message.watchId);
  });
})();
