/* Decides whether an unauthenticated visitor gets the product landing page instead of booting the app.
   Pure and dependency free: the build inlines this exact function into <head> (see vite.config.js) so the decision is
   made before any app code is fetched, and node --test exercises the same source. */
export function shouldShowLanding(env) {
  var search = env.search || '', hash = env.hash || '', keys = env.storageKeys || [];
  var urlText = search + '&' + hash.replace(/^#/, '');
  if (/(^|[?&#])(type=recovery|access_token=|refresh_token=|code=|error_description=|error=)/.test(urlText)) return false;
  if (env.native || env.standalone) return false;
  for (var i = 0; i < keys.length; i++) {
    if (keys[i] === 'halaqati_v24_last_auth' || /^sb-.*-auth-token$/.test(keys[i])) return false;
  }
  if (/(^|[?&#])app=/.test(search) || hash === '#login' || hash === '#signup') return false;
  if (env.webdriver) return /(^|[?&])landing=1/.test(search);
  return true;
}
