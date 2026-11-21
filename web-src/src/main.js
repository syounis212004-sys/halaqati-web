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
import './styles/desktop.css';
import './styles/nx.css';
import './styles/native-sessions.css';
import './styles/native-roster.css';
import './styles/native-students.css';
import './styles/native-plans.css';
import './styles/native-management.css';
import './styles/native-reports.css';
import './styles/native-tools.css';
import './styles/native-phases.css';
import './styles/native-community.css';
import './styles/native-certificates.css';
import './styles/native-home.css';
import './styles/rc50.css';
import './styles/rc52.css';
import './styles/rc53.css';
import './styles/rc54.css';
import './styles/rc85.css';
import './styles/tokens.css';
import './styles/rc86.css';
import './styles/supervisor.css';
import './styles/supervisor-skin.css';
import './styles/nour.css';
import './styles/donor.css';
import './styles/admin.css';
import './styles/motion.css';
import './styles/identity.css';
import './core/motion-system.js';
import * as supervisorUI from './features/supervisor/dashboard.mjs';
import * as supervisionUI from './features/supervisor/supervision.mjs';
window.SupervisorUI = { ...supervisorUI, ...supervisionUI };
import rc50RuntimeUrl from './features/rc50/runtime.js?url';
import rc50DonorUrl from './features/rc50/donor.js?url';
import rc50AdminUrl from './features/rc50/admin.js?url';
import rc50ShellUrl from './features/rc50/shell.js?url';
import rc52RuntimeUrl from './features/rc52/runtime.js?url';
import rc52StaffUrl from './features/rc52/staff.js?url';
import rc52SpanUrl from './features/rc52/span.js?url';
import rc53RuntimeUrl from './features/rc53/runtime.js?url';
import rc54MotionUrl from './features/rc54/motion.js?url';
import rc54ChatUrl from './features/rc54/chat.js?url';
import rc66ExamsUrl from './features/rc66/exams.js?url';
import rc85PortalUrl from './features/rc85/portal.js?url';
import rc86ParityUrl from './features/rc86/parity.js?url';
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
import rc27DesktopUrl from './features/rc27/desktop.js?url';
import nativeIconsUrl from './features/native/icons.js?url';
import nativeNxUrl from './features/native/nx.js?url';
import nativeSessionsUrl from './features/native/sessions.js?url';
import nativeRosterUrl from './features/native/roster.js?url';
import nativeStudentsUrl from './features/native/students.js?url';
import nativePlansUrl from './features/native/plans.js?url';
import nativeManagementUrl from './features/native/management.js?url';
import nativeReportsUrl from './features/native/reports.js?url';
import nativeToolsUrl from './features/native/tools.js?url';
import nativePhasesUrl from './features/native/phases.js?url';
import nativeCommunityUrl from './features/native/community.js?url';
import nativeCertificatesUrl from './features/native/certificates.js?url';
import nativeHomeUrl from './features/native/home.js?url';
import nativeApprovalsUrl from './features/native/approvals.js?url';
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

/* Boot scripts in execution order (they share globals, so the order is part of the contract). [url, element id, optional]
   Every URL is fetched in parallel (preload) while execution below stays strictly sequential: one network round trip, not one per script. */
const BOOT_SCRIPTS = [
  // Only true boot dependencies are loaded before the legacy runtime.
  [`${base}core/supabase-2.min.js`, 'halaqati-core-supabase'],
  // Quran layout metadata is optional; the legacy runtime already has a fallback.
  [`${base}core/quran-layout.js`, 'halaqati-core-quran-layout', true],
  // Phase 3: load the classic-compatible modules in dependency order. They share the
  // same global lexical environment as the old single file, preserving existing behavior.
  [rc27DataUrl, 'halaqati-complete-data'],
  [sessionServerUrl, 'halaqati-session-server'],
  [coreRuntimeUrl, 'halaqati-core-runtime'],
  [latinDigitsRuntimeUrl, 'halaqati-latin-digits-runtime'],
  [navigationRuntimeUrl, 'halaqati-navigation-runtime'],
  [authRuntimeUrl, 'halaqati-auth-runtime'],
  [masterDataRuntimeUrl, 'halaqati-master-data-runtime'],
  [studentsRuntimeUrl, 'halaqati-students-runtime'],
  [sessionsRuntimeUrl, 'halaqati-sessions-runtime'],
  [settingsRuntimeUrl, 'halaqati-settings-runtime'],
  [legacyUrl, 'halaqati-legacy-runtime'],
  // Smart plans are additive and intentionally load after legacy overrides.
  [planHealthUrl, 'halaqati-native-plan-health'],
  [smartPlansRuntimeUrl, 'halaqati-smart-plans-runtime'],
  // v2.42 parent dashboard/ranking layer depends on smart-plan calculations.
  [guardianRuntimeUrl, 'halaqati-guardian-v242-runtime'],
  [notificationsRuntimeUrl, 'halaqati-notifications-runtime'],
  // Reports/PDF keeps the Arabic-safe HQ rendering path; v2.40 only adds auto-fit table layout before capture.
  [reportsRuntimeUrl, 'halaqati-reports-runtime'],
  // v2.19 Operations Suite loads after all page/report overrides so it can isolate tracks and add safety.
  [operationsRuntimeUrl, 'halaqati-operations-runtime'],
  // v2.30 Performance Core is deliberately final so it optimizes the composed v2.20 runtime without deleting legacy behavior.
  [performanceRuntimeUrl, 'halaqati-performance-runtime'],
  // v2.40 Live Halaqa is last functional layer: it owns the daily workflow and robust quick-memorization entry points.
  [liveHalaqaRuntimeUrl, 'halaqati-live-halaqa-runtime'],
  // v2.40.8 saves the exact Chromium print layout directly to Downloads without Print Spooler; system printing remains isolated.
  [vectorPdfRuntimeUrl, 'halaqati-vector-pdf-runtime'],
  // v2.41 manual local certificate center uses the same stable Chromium vector engine.
  [certificatePdfUrl, 'halaqati-arabic-certificate-pdf'],
  [certificateServerUrl, 'halaqati-certificate-server'],
  [certificatesRuntimeUrl, 'halaqati-certificates-runtime'],
  // Startup stays last so every function/override is present before auth restoration begins.
  [nativeIconsUrl, 'halaqati-native-icons'],
  [nativeNxUrl, 'halaqati-native-nx'],
  [rc27RuntimeUrl, 'halaqati-rc27-runtime'],
  [rc27ScopeUrl, 'halaqati-rc27-scope'],
  [rc27ProgramsUrl, 'halaqati-rc27-programs'],
  [rc27IconsUrl, 'halaqati-rc27-icons'],
  [rc27UiUrl, 'halaqati-rc27-ui'],
  [rc27PhasesUrl, 'halaqati-rc27-phases'],
  [rc27PlansUrl, 'halaqati-rc27-plans'],
  [rc27MotionUrl, 'halaqati-rc27-motion'],
  [rc27DashboardUrl, 'halaqati-rc27-dashboard'],
  [rc27InsightsUrl, 'halaqati-rc27-insights'],
  [rc27GuardianUrl, 'halaqati-rc27-guardian'],
  [rc27DesktopUrl, 'halaqati-rc27-desktop'],
  [nativeSessionsUrl, 'halaqati-native-sessions'],
  [nativeRosterUrl, 'halaqati-native-roster'],
  [nativeStudentsUrl, 'halaqati-native-students'],
  [nativePlansUrl, 'halaqati-native-plans'],
  [nativeManagementUrl, 'halaqati-native-management'],
  [nativeReportsUrl, 'halaqati-native-reports'],
  [nativeToolsUrl, 'halaqati-native-tools'],
  [nativePhasesUrl, 'halaqati-native-phases'],
  [nativeCommunityUrl, 'halaqati-native-community'],
  [nativeCertificatesUrl, 'halaqati-native-certificates'],
  [nativeHomeUrl, 'halaqati-native-home'],
  [nativeApprovalsUrl, 'halaqati-native-approvals'],
  [rc50RuntimeUrl, 'halaqati-rc50-runtime'],
  [rc50DonorUrl, 'halaqati-rc50-donor'],
  [rc50AdminUrl, 'halaqati-rc50-admin'],
  [rc50ShellUrl, 'halaqati-rc50-shell'],
  [rc52SpanUrl, 'halaqati-rc52-span'],
  [rc52RuntimeUrl, 'halaqati-rc52-runtime'],
  [rc52StaffUrl, 'halaqati-rc52-staff'],
  [rc53RuntimeUrl, 'halaqati-rc53-runtime'],
  [rc54MotionUrl, 'halaqati-rc54-motion'],
  [rc54ChatUrl, 'halaqati-rc54-chat'],
  [rc66ExamsUrl, 'halaqati-rc66-exams'],
  [rc85PortalUrl, 'halaqati-rc85-portal'],
  [rc86ParityUrl, 'halaqati-rc86-parity'],
  [startupRuntimeUrl, 'halaqati-startup-runtime'],
];

async function boot() {
  installSmartPlansEngine(window);
  BOOT_SCRIPTS.forEach(([href]) => { const l = document.createElement('link'); l.rel = 'preload'; l.as = 'script'; l.href = href; document.head.appendChild(l); });
  // v2.14: open the durable IndexedDB layer before any classic runtime restores cached data.
  await installHalaqatiOfflineStore();
  for (const [src, id, optional] of BOOT_SCRIPTS) {
    if (optional) { try { await loadClassicScript(src, { id }); } catch (e) { console.warn(e); } } else await loadClassicScript(src, { id });
  }
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
