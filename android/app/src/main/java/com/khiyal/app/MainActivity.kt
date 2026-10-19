package com.khiyal.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.*
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabsIntent
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private var chooser: ValueCallback<Array<Uri>>? = null
    private val base = BuildConfig.BASE_URL
    private val pick = registerForActivityResult(ActivityResultContracts.GetMultipleContents()) { uris ->
        chooser?.onReceiveValue(uris.toTypedArray()); chooser = null
    }
    private val notifPerm = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        KhiyalChannel.ensure(this)
        web = WebView(this).also { setContentView(it) }
        web.settings.apply {
            javaScriptEnabled = true; domStorageEnabled = true
            userAgentString = "$userAgentString KhiyalApp/1.0"
        }
        CookieManager.getInstance().apply { setAcceptCookie(true); setAcceptThirdPartyCookies(web, true) }

        // الجسر: الويب يطلب التوكن، والتطبيق يسلّمه عبر window.khiyalRegisterToken
        web.addJavascriptInterface(object {
            @JavascriptInterface fun requestPermission() {
                runOnUiThread {
                    if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this@MainActivity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
                        notifPerm.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
            @JavascriptInterface fun requestToken() {
                FirebaseMessaging.getInstance().token.addOnSuccessListener { t ->
                    runOnUiThread { web.evaluateJavascript("window.khiyalRegisterToken&&window.khiyalRegisterToken('$t')", null) }
                }
            }
        }, "KhiyalNative")

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                val u = r.url; val host = u.host ?: return false
                if (host == Uri.parse(base).host) return false
                // Google يمنع OAuth داخل WebView → Custom Tab؛ العودة تأتي برابط التطبيق /auth/callback
                if (host == "accounts.google.com" || (host.endsWith(".supabase.co") && u.path?.startsWith("/auth/") == true)) {
                    CustomTabsIntent.Builder().build().launchUrl(this@MainActivity, u); return true
                }
                startActivity(Intent(Intent.ACTION_VIEW, u)); return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(w: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
                chooser?.onReceiveValue(null); chooser = cb; pick.launch("image/*"); return true
            }
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { if (web.canGoBack()) web.goBack() else finish() }
        })
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED)
            notifPerm.launch(Manifest.permission.POST_NOTIFICATIONS)
        if (savedInstanceState == null) route(intent) else web.restoreState(savedInstanceState)
    }

    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); route(intent) }
    override fun onSaveInstanceState(out: Bundle) { super.onSaveInstanceState(out); web.saveState(out) }

    /** رابط تطبيق (OAuth/مشاركة) أو رابط عميق من إشعار (مسار داخلي يبدأ بـ /) */
    private fun route(i: Intent?) {
        val data = i?.data; val link = i?.getStringExtra("link")
        when {
            data != null && data.host == Uri.parse(base).host -> web.loadUrl(data.toString())
            link != null && link.startsWith("/") && !link.startsWith("//") -> web.loadUrl(base + link)
            else -> if (web.url == null) web.loadUrl(base)
        }
    }
}
