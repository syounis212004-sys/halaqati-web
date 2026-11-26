/* Real entry point. The inline gate in index.html marks signed-out visitors with <html data-landing>.
   Everyone else boots the unchanged app (src/main.js) straight away; landing visitors load only the landing chunk and
   pull the app in when they press "تسجيل الدخول". */
let appPromise, landing;
const loadApp = () => (appPromise ||= import('./main.js'));

if (document.documentElement.hasAttribute('data-landing')) {
  const openApp = () => {
    if (landing) landing.destroyLanding();
    /* the visitor asked for the login form: skip the brand splash that would otherwise cover it for a few seconds */
    const splash = document.getElementById('rc27Splash'); if (splash) splash.remove();
    document.documentElement.removeAttribute('data-landing');
    try { history.replaceState(null, '', location.pathname + location.search + '#login'); } catch (_e) { /* ignore */ }
    window.scrollTo(0, 0);
    loadApp();
  };
  import('./landing/index.js').then((m) => { landing = m; return m.mountLanding({ openApp }); }).catch((e) => { console.warn('landing failed, opening app', e); openApp(); });
} else {
  loadApp();
}
