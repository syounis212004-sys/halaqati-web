export function createUpdateBanner(updateSW) {
  if (document.getElementById('halaqati-update-banner')) return;
  const box = document.createElement('div');
  box.id = 'halaqati-update-banner';
  box.dir = 'rtl';
  box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:#0d3b2f;color:#fff;border-radius:15px;padding:12px 14px;box-shadow:0 12px 35px #0004;display:flex;gap:10px;align-items:center;font-family:Cairo,Tahoma,Arial,sans-serif';
  box.innerHTML = '<b style="flex:1">يتوفر تحديث جديد لنسخة حلقتي.</b><button type="button" style="border:0;border-radius:10px;padding:8px 12px;font-weight:800">تحديث الآن</button>';
  box.querySelector('button').onclick = () => updateSW(true);
  document.body.appendChild(box);
}
