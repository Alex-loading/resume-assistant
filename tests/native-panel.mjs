// Playwright does not expose Chrome's tabless side-panel target as a Page.
// Attach to that real native target through CDP; no extension APIs are mocked.
import { writeFile } from 'node:fs/promises';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function nativePanel(cdp, url, errors) {
  let info;
  for (let attempt = 0; attempt < 100; attempt++) {
    info = (await cdp.send('Target.getTargets')).targetInfos.find(t => t.url === url);
    if (info) break;
    await sleep(100);
  }
  if (!info) throw new Error('Chrome 没有创建原生侧栏');
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId: info.targetId, flatten: false });
  const pending = new Map(); let nextId = 0, closed = false;
  cdp.on('Target.receivedMessageFromTarget', event => {
    if (event.sessionId !== sessionId) return;
    const result = JSON.parse(event.message);
    if (result.id) {
      const task = pending.get(result.id); if (!task) return;
      clearTimeout(task.timer); pending.delete(result.id);
      if (result.error) task.reject(new Error(result.error.message)); else task.resolve(result.result);
    } else if (result.method === 'Runtime.exceptionThrown') errors.push(result.params.exceptionDetails.exception?.description || result.params.exceptionDetails.text);
  });
  cdp.on('Target.detachedFromTarget', event => { if (event.sessionId === sessionId) closed = true; });
  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Side panel CDP timeout: '+method)); }, 10000);
      pending.set(id, { resolve, reject, timer });
      cdp.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(error => { clearTimeout(timer); pending.delete(id); reject(error); });
    });
  }
  async function evaluate(fn, arg) {
    const result = await send('Runtime.evaluate', { expression: `(${fn.toString()})(${JSON.stringify(arg) ?? 'undefined'})`, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  }
  async function waitForFunction(fn, arg) {
    for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(fn, arg)) return; await sleep(100); }
    throw new Error('Side panel condition timed out: '+fn.toString()+'\n'+await evaluate(()=>document.body.innerText));
  }
  function locator(selector, filters = {}) {
    const query = (action, value) => evaluate(({selector, filters, action, value}) => {
      const nodes = [...document.querySelectorAll(selector)].filter(node => {
        const name = node.getAttribute('aria-label') || node.innerText?.trim() || '';
        return (!filters.name || (filters.exact ? name === filters.name : name.includes(filters.name))) && (!filters.hasText || node.textContent.includes(filters.hasText));
      });
      if (action === 'count') return nodes.length;
      if (action === 'visible') return nodes.length === 1 && nodes[0].getClientRects().length > 0;
      if (nodes.length !== 1) throw new Error(`Expected one ${selector}, found ${nodes.length}`);
      const node = nodes[0];
      if (action === 'disabled') return Boolean(node.disabled);
      if (action === 'attribute') return node.getAttribute(value);
      if (action === 'value') return node.value;
      if (action === 'text') return node.innerText;
      if (node.disabled) throw new Error('Cannot interact with a disabled control: '+selector);
      if (action === 'click') node.click();
      if (action === 'fill') { node.focus(); node.value = value; node.dispatchEvent(new Event('input', { bubbles:true })); }
      if (action === 'select') { node.value = value; node.dispatchEvent(new Event('change', { bubbles:true })); }
      if (action === 'check' && !node.checked) node.click();
    }, {selector, filters, action, value});
    const wait = async() => { for(let i=0;i<100;i++){if(await query('visible'))return;await sleep(100);}throw new Error('Side panel locator timed out: '+selector+' '+JSON.stringify(filters)); };
    return {
      waitFor:wait, count:()=>query('count'), isDisabled:()=>query('disabled'), inputValue:()=>query('value'), getAttribute:value=>query('attribute',value), innerText:()=>query('text'),
      click:async()=>{await wait();await query('click');},fill:async value=>{await wait();await query('fill',value);},selectOption:async value=>{await wait();await query('select',value);},check:async()=>{await wait();await query('check');},
      filter:options=>locator(selector,{...filters,...options})
    };
  }
  await send('Runtime.enable');
  return { evaluate, waitForFunction, locator, isClosed:()=>closed,
    getByRole:(role,options={})=>locator(role==='button'?'button':`[role="${role}"]`,options),
    screenshot:async({path})=>{const {data}=await send('Page.captureScreenshot',{format:'png'});await writeFile(path,Buffer.from(data,'base64'));},
    close:()=>cdp.send('Target.closeTarget',{targetId:info.targetId})
  };
}
