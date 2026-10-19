import { version as webVersion } from '../package.json';
import './core/view.js';
import './core/install.js';
import './styles/app.css';
import './styles/uiux-pro-max.css';
import './styles/live-halaqa.css';
import './styles/certificates.css';
import './styles/rc27.css';
import './styles/apk.css';
import './styles/responsive.css';
import rc27DataUrl from './features/rc27/data.js?url';
import sessionServerUrl from './features/sessions/server.js?url';
import coreRuntimeUrl from './core/runtime.js?url';
import navigationRuntimeUrl from './core/navigation.js?url';
import latinDigitsRuntimeUrl from './core/latin-digits-runtime.js?url';
import authRuntimeUrl from './features/auth/runtime.js?url';
import masterDataRuntimeUrl from './features/master-data/runtime.js?url';
import studentsRuntimeUrl from './features/students/runtime.js?url';
import sessionsRuntimeUrl from './features/sessions/runtime.js?url';
import settingsRuntimeUrl from './features/settings/runtime.js?url';
import notificationsRuntimeUrl from './features/notifications/runtime.js?url';
import legacyUrl from './legacy/app.js?url';
import startupRuntimeUrl from './core/startup.js?url';
import reportsRuntimeUrl from './features/reports/runtime.js?url';
import vectorPdfRuntimeUrl from './features/reports/vector-pdf-runtime.js?url';
import rc27RuntimeUrl from './features/rc27/runtime.js?url';
import rc27ScopeUrl from './features/rc27/scope.js?url';
import rc27ProgramsUrl from './features/rc27/programs.js?url';
import rc27IconsUrl from './features/rc27/icons.js?url';
import rc27UiUrl from './features/rc27/ui.js?url';
import rc27GuardianUrl from './features/rc27/guardian.js?url';
import rc27MotionUrl from './features/rc27/motion.js?url';
import rc27PhasesUrl from './features/rc27/phases.js?url';
import rc27DashboardUrl from './features/rc27/dashboard.js?url';
import rc27InsightsUrl from './features/rc27/insights.js?url';
import rc27PlansUrl from './features/rc27/plans.js?url';
import certificatePdfUrl from './features/certificates/pdf.js?url';
import certificateServerUrl from './features/certificates/server.js?url';
import certificatesRuntimeUrl from './features/certificates/runtime.js?url';
import planHealthUrl from './features/plans/health.js?url';
import smartPlansRuntimeUrl from './features/plans/runtime.js?url';
import guardianRuntimeUrl from './features/guardian/runtime.js?url';
import operationsRuntimeUrl from './features/operations/runtime.js?url';
import performanceRuntimeUrl from './core/performance-runtime.js?url';
import liveHalaqaRuntimeUrl from './features/live-halaqa/runtime.js?url';
import { loadClassicScript } from './core/script-loader.js';
import './core/lazy-libs.js';
import './features/notifications/push-bridge.js';
import { installReportLazyLoading } from './features/reports/lazy.js';
import { installImportLazyLoading } from './features/import/lazy.js';
import { registerHalaqatiPwa } from './core/pwa.js';
import { installHalaqatiOfflineStore } from './core/offline-store.js';
import { installSmartPlansEngine } from './features/plans/engine.js';
const base = import.meta.env.BASE_URL;
window.HALAQATI_WEB_VERSION=webVersion;

async function boot() {
  installSmartPlansEngine(window);
  // v2.14: open the durable IndexedDB layer before any classic runtime restores cached data.
  await installHalaqatiOfflineStore();
  // Only true boot dependencies are loaded before the legacy runtime.
  await loadClassicScript(`${base}core/supabase-2.min.js`, { id: 'halaqati-core-supabase' });
  // Quran layout metadata is optional; the legacy runtime already has a fallback.
  try { await loadClassicScript(`${base}core/quran-layout.js`, { id: 'halaqati-core-quran-layout' }); } catch (e) { console.warn(e); }

  // Phase 3: load the classic-compatible modules in dependency order. They share the
  // same global lexical environment as the old single file, preserving existing behavior.
  await loadClassicScript(rc27DataUrl, { id: 'halaqati-complete-data' });
  await loadClassicScript(sessionServerUrl, { id: 'halaqati-session-server' });
  await loadClassicScript(coreRuntimeUrl, { id: 'halaqati-core-runtime' });
  await loadClassicScript(latinDigitsRuntimeUrl, { id: 'halaqati-latin-digits-runtime' });
  await loadClassicScript(navigationRuntimeUrl, { id: 'halaqati-navigation-runtime' });
  await loadClassicScript(authRuntimeUrl, { id: 'halaqati-auth-runtime' });
  await loadClassicScript(masterDataRuntimeUrl, { id: 'halaqati-master-data-runtime' });
  await loadClassicScript(studentsRuntimeUrl, { id: 'halaqati-students-runtime' });
  await loadClassicScript(sessionsRuntimeUrl, { id: 'halaqati-sessions-runtime' });
  await loadClassicScript(settingsRuntimeUrl, { id: 'halaqati-settings-runtime' });
  await loadClassicScript(legacyUrl, { id: 'halaqati-legacy-runtime' });
  // Smart plans are additive and intentionally load after legacy overrides.
  await loadClassicScript(planHealthUrl, { id: 'halaqati-native-plan-health' });
  await loadClassicScript(smartPlansRuntimeUrl, { id: 'halaqati-smart-plans-runtime' });
  // v2.42 parent dashboard/ranking layer depends on smart-plan calculations.
  await loadClassicScript(guardianRuntimeUrl, { id: 'halaqati-guardian-v242-runtime' });
  await loadClassicScript(notificationsRuntimeUrl, { id: 'halaqati-notifications-runtime' });
  // Reports/PDF keeps the Arabic-safe HQ rendering path; v2.40 only adds auto-fit table layout before capture.
  await loadClassicScript(reportsRuntimeUrl, { id: 'halaqati-reports-runtime' });
  // v2.19 Operations Suite loads after all page/report overrides so it can isolate tracks and add safety.
  await loadClassicScript(operationsRuntimeUrl, { id: 'halaqati-operations-runtime' });
  // v2.30 Performance Core is deliberately final so it optimizes the composed v2.20 runtime without deleting legacy behavior.
  await loadClassicScript(performanceRuntimeUrl, { id: 'halaqati-performance-runtime' });
  // v2.40 Live Halaqa is last functional layer: it owns the daily workflow and robust quick-memorization entry points.
  await loadClassicScript(liveHalaqaRuntimeUrl, { id: 'halaqati-live-halaqa-runtime' });
  // v2.40.8 saves the exact Chromium print layout directly to Downloads without Print Spooler; system printing remains isolated.
  await loadClassicScript(vectorPdfRuntimeUrl, { id: 'halaqati-vector-pdf-runtime' });
  // v2.41 manual local certificate center uses the same stable Chromium vector engine.
  await loadClassicScript(certificatePdfUrl, { id: 'halaqati-arabic-certificate-pdf' });
  await loadClassicScript(certificateServerUrl, { id: 'halaqati-certificate-server' });
  await loadClassicScript(certificatesRuntimeUrl, { id: 'halaqati-certificates-runtime' });
  // Startup stays last so every function/override is present before auth restoration begins.
  await loadClassicScript(rc27RuntimeUrl, { id: 'halaqati-rc27-runtime' });
  await loadClassicScript(rc27ScopeUrl, { id: 'halaqati-rc27-scope' });
  await loadClassicScript(rc27ProgramsUrl, { id: 'halaqati-rc27-programs' });
  await loadClassicScript(rc27IconsUrl, { id: 'halaqati-rc27-icons' });
  await loadClassicScript(rc27UiUrl, { id: 'halaqati-rc27-ui' });
  await loadClassicScript(rc27PhasesUrl, { id: 'halaqati-rc27-phases' });
  await loadClassicScript(rc27PlansUrl, { id: 'halaqati-rc27-plans' });
  await loadClassicScript(rc27MotionUrl, { id: 'halaqati-rc27-motion' });
  await loadClassicScript(rc27DashboardUrl, { id: 'halaqati-rc27-dashboard' });
  await loadClassicScript(rc27InsightsUrl, { id: 'halaqati-rc27-insights' });
  await loadClassicScript(rc27GuardianUrl, { id: 'halaqati-rc27-guardian' });
  await loadClassicScript(startupRuntimeUrl, { id: 'halaqati-startup-runtime' });
  installReportLazyLoading();
  installImportLazyLoading();
  registerHalaqatiPwa();

  window.dispatchEvent(new CustomEvent('halaqati:ready', { detail: { version: webVersion, architecture: 'vite-offline-smart-plans-operations-suite-uiux-pro-max-performance-core-live-halaqa-latin-digits-chromium-direct-vector-pdf-layout-safe-mediastore-isolated-print-guardian-v6-cohort-ranks-local-certificates-official-capacitor-push-arabic-rtl' } }));
}

boot().catch((error) => {
  console.error('Halaqati startup failed', error);
  const box = document.createElement('div');
  box.dir = 'rtl';
  box.style.cssText = 'margin:20px;padding:16px;border:1px solid #e4b8b8;border-radius:14px;background:#fff0f0;color:#8c3333;font-family:Tahoma,Arial,sans-serif';
  box.textContent = 'تعذر تشغيل حلقتي. أعد تحميل الصفحة. التفاصيل: ' + (error?.message || error);
  document.body.prepend(box);
});
