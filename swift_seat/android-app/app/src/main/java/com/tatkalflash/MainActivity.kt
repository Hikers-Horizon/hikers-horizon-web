package com.tatkalflash

import android.annotation.SuppressLint
import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.io.IOException

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var logTextView: TextView

    companion object {
        var instance: MainActivity? = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instance = this
        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webview)
        logTextView = findViewById(R.id.log_text)

        val active = getSharedPreferences("TatkalFlash", MODE_PRIVATE).getBoolean("extension_active", false)
        logTextView.visibility = if (active) android.view.View.VISIBLE else android.view.View.GONE
        
        val webSettings = webView.settings
        webSettings.javaScriptEnabled = true
        webSettings.domStorageEnabled = true
        webSettings.databaseEnabled = true
        webSettings.allowFileAccess = true

        // Interface for JavaScript to communicate with Android
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun getBookingConfig(): String {
                val sharedPref = getSharedPreferences("TatkalFlash", MODE_PRIVATE)
                return sharedPref.getString("bookingConfig", "{}") ?: "{}"
            }

            @JavascriptInterface
            fun saveBookingConfig(configJson: String) {
                val sharedPref = getSharedPreferences("TatkalFlash", MODE_PRIVATE)
                sharedPref.edit().putString("bookingConfig", configJson).apply()
            }

            @JavascriptInterface
            fun isExtensionActive(): Boolean {
                val sharedPref = getSharedPreferences("TatkalFlash", MODE_PRIVATE)
                return sharedPref.getBoolean("extension_active", false)
            }

            @JavascriptInterface
            fun setExtensionActive(active: Boolean) {
                val sharedPref = getSharedPreferences("TatkalFlash", MODE_PRIVATE)
                sharedPref.edit().putBoolean("extension_active", active).apply()
                runOnUiThread {
                    logTextView.visibility = if (active) android.view.View.VISIBLE else android.view.View.GONE
                    if (!active) logTextView.text = ""
                }
            }
            
            @JavascriptInterface
            fun navigateTo(url: String) {
                runOnUiThread {
                    webView.loadUrl(url)
                }
            }

            @JavascriptInterface
            fun isAccessibilityEnabled(): Boolean {
                return isAccessibilityServiceEnabled()
            }

            @JavascriptInterface
            fun openAccessibilitySettings() {
                runOnUiThread {
                    val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                    startActivity(intent)
                }
            }

            @JavascriptInterface
            fun launchRailOne() {
                runOnUiThread {
                    try {
                        var intent = packageManager.getLaunchIntentForPackage("org.cris.aikyam")
                        if (intent == null) {
                            intent = packageManager.getLaunchIntentForPackage("com.railone")
                        }
                        if (intent == null) {
                            intent = packageManager.getLaunchIntentForPackage("cris.org.in.prs.ima")
                        }
                        
                        if (intent != null) {
                            startActivity(intent)
                        } else {
                            webView.evaluateJavascript("document.getElementById('status-box').className='status error'; document.getElementById('status-box').textContent='Error: RailOne app not installed on your phone.';", null)
                        }
                    } catch (e: Exception) {
                        webView.evaluateJavascript("document.getElementById('status-box').className='status error'; document.getElementById('status-box').textContent='Error launching: " + e.message + "';", null)
                    }
                }
            }
        }, "AndroidInterface")

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return false
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                return false
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                
                // Check if automation is active
                val sharedPref = getSharedPreferences("TatkalFlash", MODE_PRIVATE)
                val active = sharedPref.getBoolean("extension_active", false)
                
                if (active && url != null && (url.contains("irctc.co.in") || url.contains("aranyavihaara.karnataka.gov.in"))) {
                    injectContentScript()
                }
            }
        }

        // Diagnostics: Log all installed packages containing keywords to help identify the package name
        try {
            val packages = packageManager.getInstalledPackages(0)
            val keywords = listOf("rail", "cris", "aikyam", "irctc", "tatkal")
            addLog("--- Diagnostics: Installed Booking Apps ---")
            var foundAny = false
            for (pkgInfo in packages) {
                val pkgName = pkgInfo.packageName
                for (kw in keywords) {
                    if (pkgName.contains(kw, ignoreCase = true)) {
                        addLog("Found: ${pkgInfo.applicationInfo.loadLabel(packageManager)} ($pkgName)")
                        foundAny = true
                        break
                    }
                }
            }
            if (!foundAny) {
                addLog("No apps matching rail/cris/aikyam/irctc/tatkal found.")
            }
            addLog("-------------------------------------------")
        } catch (e: Exception) {
            addLog("Diagnostic error: ${e.message}")
        }

        // Start by loading our control panel from assets
        webView.loadUrl("file:///android_asset/index.html")
    }

    override fun onDestroy() {
        super.onDestroy()
        instance = null
    }

    fun addLog(message: String) {
        runOnUiThread {
            val timestamp = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())
            val currentText = logTextView.text.toString()
            val newText = "[$timestamp] $message\n$currentText"
            logTextView.text = newText.take(5000) // Keep last 5000 chars
        }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val expectedComponentName = ComponentName(this, BookingAccessibilityService::class.java)
        val enabledServices = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false

        val colonSplitter = TextUtils.SimpleStringSplitter(':')
        colonSplitter.setString(enabledServices)
        while (colonSplitter.hasNext()) {
            val componentNameString = colonSplitter.next()
            val enabledComponent = ComponentName.unflattenFromString(componentNameString)
            if (enabledComponent != null && enabledComponent == expectedComponentName) {
                return true
            }
        }
        return false
    }

    private fun injectContentScript() {
        try {
            val stream = assets.open("content.js")
            val size = stream.available()
            val buffer = ByteArray(size)
            stream.read(buffer)
            stream.close()
            val script = String(buffer)
            
            // Inject JS into page
            webView.post {
                webView.evaluateJavascript(script, null)
            }
        } catch (e: IOException) {
            e.printStackTrace()
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
