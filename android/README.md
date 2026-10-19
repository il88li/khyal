# تطبيق خيال لأندرويد (WebView)
1. افتح مجلد `android` في Android Studio (يولّد Gradle wrapper تلقائياً).
2. Firebase Console → أضف تطبيق Android بالحزمة `com.khiyal.app` ونزّل `google-services.json` إلى `android/app/`.
3. غيّر `BASE_URL` في `app/build.gradle.kts` والنطاق في `AndroidManifest.xml` إلى نطاقك.
4. **تسجيل دخول Google**: يفتح في Custom Tab ويعود عبر رابط التطبيق `/auth/callback`، ويتطلب نشر الملف
   `https://khiyal-web.vercel.app/.well-known/assetlinks.json` ببصمة SHA-256 لتوقيع التطبيق (App Links)؛ بدونه لن تعود الجلسة للتطبيق.
5. الإشعارات: الخادم يرسل رسائل بيانات (title, body, link) فيعرضها `KhiyalMessagingService`، والضغط يفتح الشاشة المعنية.
> لم يُبنَ هذا المشروع ولم يُجرَّب بعد.
