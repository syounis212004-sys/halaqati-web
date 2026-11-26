/* Real entry point. The inline gate in index.html marks signed-out visitors with <html data-landing>.
   Everyone else boots the unchanged app (src/main.js) straight away; landing visitors load only the landing chunk and
   pull the app in when they press "تسجيل الدخول" (#login) or "ابدأ الآن / إنشاء حساب" (#signup). */
let appPromise, landing;
const loadApp = () => (appPromise ||= import('./main.js'));

/* #signup shows the app's own sign-up form (the account still needs the administrator's approval). It also works as a plain deep link. */
function showSignupWhenReady() {
  window.addEventListener('halaqati:ready', () => {
    const auth = document.getElementById('auth');
    if (typeof window.toggleSignup === 'function' && auth && !auth.classList.contains('hidden')) window.toggleSignup(true);
  }, { once: true });
}

if (document.documentElement.hasAttribute('data-landing')) {
  const openApp = (mode) => {
    const target = mode === 'signup' ? 'signup' : 'login';
    if (landing) landing.destroyLanding();
    /* the visitor asked for a form: skip the brand splash that would otherwise cover it for a few seconds */
    const splash = document.getElementById('rc27Splash'); if (splash) splash.remove();
    document.documentElement.removeAttribute('data-landing');
    try { history.replaceState(null, '', location.pathname + location.search + '#' + target); } catch (_e) { /* ignore */ }
    window.scrollTo(0, 0);
    if (target === 'signup') showSignupWhenReady();
    loadApp();
  };
  import('./landing/index.js').then((m) => { landing = m; return m.mountLanding({ openApp }); }).catch((e) => { console.warn('landing failed, opening app', e); openApp('login'); });
} else {
  if (location.hash === '#signup') showSignupWhenReady();
  loadApp();
}
