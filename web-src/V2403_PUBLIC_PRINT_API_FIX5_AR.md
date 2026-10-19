# v2.40.3 Public Print API FIX5

- أصلح فشل Java compile في موديول HalaqatiPdf.
- السبب: `Plugin.getActivity()` في Capacitor 8 يعتمد نوعيًا على `BridgeActivity` الذي يرث من `AppCompatActivity`، بينما موديول الإضافة لم يعلن `androidx.appcompat` على compile classpath.
- أضيف `androidx.appcompat:appcompat` باستخدام نفس متغير إصدار Capacitor مع fallback `1.7.1`.
- أضيف `androidx.core` باستخدام متغير Capacitor مع fallback `1.17.0`.
- توحيد Java source/target إلى 21 ليتطابق مع Capacitor 8.
- لا تغيير على محرك PDF: Chromium WebView + PrintManager الرسمي، Vector، Cairo، RTL، نص قابل للتحديد والبحث.
