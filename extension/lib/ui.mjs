export const $ = selector => document.querySelector(selector);
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else if (value !== false && value != null) node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of [].concat(children)) if (child != null) node.append(child);
  return node;
}
export function toast(message, error = false) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.toggle('error', error);
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), error ? 9000 : 3500);
}
export async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('已复制，可以粘贴到网页'); }
  catch { toast('复制失败，请选中文本后手动复制', true); }
}
export function icon(name, size = 20) {
  const paths = { user: 'M20 21v-2a7 7 0 0 0-14 0v2M13 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8', book: 'M4 3h7a3 3 0 0 1 3 3v15a4 4 0 0 0-4-2H4zM14 6a3 3 0 0 1 3-3h5v16h-4a4 4 0 0 0-4 2', case: 'M4 7h16v14H4zM8 7V3h8v4M4 12h16M10 12v3h4v-3', code: 'm8 6-6 6 6 6m8-12 6 6-6 6M14 3l-4 18', text: 'M4 5h16M4 12h16M4 19h10', arrow: 'M5 12h14m-5-5 5 5-5 5', check: 'm5 12 4 4L19 6', shield: 'M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7zM8 12l3 3 5-6', plus: 'M12 5v14M5 12h14', copy: 'M9 9h12v12H9zM15 9V3H3v12h6', scan: 'M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5M7 9h10M7 15h10', settings: 'M5 5h14v14H5zM9 9h6v6H9z' };
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [k,v] of Object.entries({ width:size, height:size, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', 'stroke-width':1.65, 'stroke-linecap':'round', 'stroke-linejoin':'round', 'aria-hidden':'true' })) svg.setAttribute(k,v);
  const path = document.createElementNS(svg.namespaceURI, 'path'); path.setAttribute('d', paths[name] || paths.text); svg.append(path); return svg;
}
