let installPrompt=null;
const installed=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
window.halaqatiInstallCard=function(){
  if(window.Capacitor?.isNativePlatform?.())return '';
  return `<section class="card pwa-install"><div><h3>${installed()?'حلقاتي مثبت على هذا الجهاز':'حلقاتي على جهازك'}</h3><p class="muted">نفس الحسابات والبيانات على الجوال والكمبيوتر.</p></div>${installed()?'':`<button class="btn btn-primary" type="button" onclick="halaqatiInstall()">${installPrompt?'تثبيت حلقاتي':'طريقة التثبيت'}</button>`}<div class="view-links"><a href="./?view=mobile">فتح بواجهة الجوال</a><a href="./?view=desktop">فتح بواجهة الكمبيوتر</a></div><p id="pwaInstallHelp" class="muted" hidden></p></section>`;
};
window.halaqatiCanPromptInstall=()=>!!installPrompt;
window.halaqatiInstall=async function(){
  if(installPrompt){const prompt=installPrompt;installPrompt=null;await prompt.prompt();await prompt.userChoice;return}
  const box=document.getElementById('pwaInstallHelp');if(!box)return;
  box.hidden=false;
  box.textContent=/iPhone|iPad|iPod/.test(navigator.userAgent)?'من قائمة المشاركة في Safari اختر «إضافة إلى الشاشة الرئيسية».':'من قائمة المتصفح اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». على الكمبيوتر يتوفر التثبيت في Chrome وEdge عند دعم الجهاز له.';
};
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;if(document.getElementById('pwaInstallHelp'))window.render?.()});
window.addEventListener('appinstalled',()=>{installPrompt=null;if(document.getElementById('pwaInstallHelp'))window.render?.()});
document.addEventListener('input',event=>{const form=event.target.closest?.('form');if(form)form.dataset.dirty='1'});
window.halaqatiHasPendingWork=()=>{
  try{if(window.readOfflineQueue?.().length||window.RC27Phases?.S?.loading)return true}catch(_e){}
  return [...document.querySelectorAll('form[data-dirty="1"]')].some(form=>form.closest('dialog[open]')||form.offsetParent!==null);
};
