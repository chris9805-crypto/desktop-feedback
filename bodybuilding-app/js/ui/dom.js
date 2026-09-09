/** Small DOM helpers. No framework: the app is a few screens and a form. */

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'html') el.innerHTML = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in el && key !== 'list' && typeof value !== 'object') el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  append(el, children);
  return el;
}

function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function svg(tag, props = {}, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    el.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/* ---------------------------------------------------------------- format */

export function fmtWeight(value, unit = 'kg') {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const n = Number(value);
  const rounded = Math.abs(n - Math.round(n)) < 0.01 ? Math.round(n) : Math.round(n * 100) / 100;
  return `${rounded}${unit}`;
}

export function fmtNumber(value, dp = 0) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function fmtClock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDuration(seconds) {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function fmtDateLong(ts) {
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeDay(ts) {
  const days = Math.floor((Date.now() - ts) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  return `${Math.floor(days / 7)} weeks ago`;
}
