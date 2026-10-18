const loaded = new Map();

export function loadClassicScript(src, { id } = {}) {
  if (loaded.has(src)) return loaded.get(src);
  const promise = new Promise((resolve, reject) => {
    if (id) {
      const existing = document.getElementById(id);
      if (existing?.dataset.loaded === '1') return resolve(existing);
    }
    const s = document.createElement('script');
    if (id) s.id = id;
    s.src = src;
    s.async = true;
    s.onload = () => { s.dataset.loaded = '1'; resolve(s); };
    s.onerror = () => reject(new Error(`تعذر تحميل ${src}`));
    document.head.appendChild(s);
  });
  loaded.set(src, promise);
  return promise;
}
