export function createUpdateBanner(updateSW) {
  if (document.getElementById('halaqati-update-banner')) return;
  const box = document.createElement('div');
  box.id = 'halaqati-update-banner';
  box.dir = 'rtl';
  box.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:#0d3b2f;color:#fff;border-radius:15px;padding:12px 14px;box-shadow:0 12px 35px #0004;display:flex;gap:10px;align-items:center;font-family:Cairo,Tahoma,Arial,sans-serif';
  box.style.bottom='calc(84px + env(safe-area-inset-bottom))';
  box.setAttribute('role','status');
  box.innerHTML = '<b style="flex:1">يتوفر تحديث جديد لحلقاتي.</b><button type="button" style="border:0;border-radius:10px;padding:8px 12px;font-weight:800">تحديث الآن</button><button type="button" aria-label="تأجيل التحديث" style="border:0;background:none;color:white;font-size:20px">×</button>';
  box.querySelector('button').onclick = () => {
    if(window.halaqatiHasPendingWork?.()){
      box.querySelector('b').textContent='احفظ التعديلات وأكمل المزامنة قبل التحديث. بياناتك المحلية محفوظة.';
      return;
    }
    updateSW(true);
  };
  box.querySelectorAll('button')[1].onclick=()=>box.remove();
  document.body.appendChild(box);
}
