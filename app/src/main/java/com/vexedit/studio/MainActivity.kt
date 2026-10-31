package com.vexedit.studio

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts

/**
 * Hosts the existing VexEdit React editor inside a real Android application.
 *
 * The web editor is bundled into app/src/main/assets/web at build time.
 * No remote website is required to launch the editor.
 */
class MainActivity : ComponentActivity() {
    private var editorWebView: WebView? = null
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = fileChooserCallback ?: return@registerForActivityResult
        fileChooserCallback = null
        val selectedUris = if (result.resultCode == RESULT_OK) {
            WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        } else {
            null
        }
        callback.onReceiveValue(selectedUris)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)

        val webView = WebView(this).apply {
            setBackgroundColor(android.graphics.Color.rgb(16, 16, 20))
            visibility = View.VISIBLE
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.allowFileAccess = true
            settings.allowContentAccess = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            settings.loadsImagesAutomatically = true
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = false

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    // Keep the editor self-contained. External links are not allowed
                    // to replace the application with an arbitrary website.
                    return request.url.scheme != "file" &&
                        request.url.host != "appassets.androidplatform.net"
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    webView: WebView,
                    filePathCallback: ValueCallback<Array<Uri>>,
                    fileChooserParams: FileChooserParams
                ): Boolean {
                    this@MainActivity.fileChooserCallback?.onReceiveValue(null)
                    this@MainActivity.fileChooserCallback = filePathCallback
                    return try {
                        fileChooserLauncher.launch(fileChooserParams.createIntent())
                        true
                    } catch (error: Exception) {
                        this@MainActivity.fileChooserCallback = null
                        filePathCallback.onReceiveValue(null)
                        Toast.makeText(
                            this@MainActivity,
                            "Dosya seçici açılamadı: ${error.localizedMessage ?: "Bilinmeyen hata"}",
                            Toast.LENGTH_LONG
                        ).show()
                        false
                    }
                }

                override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                    android.util.Log.d(
                        "VexEditWeb",
                        "${consoleMessage.message()} (${consoleMessage.sourceId()}:${consoleMessage.lineNumber()})"
                    )
                    return true
                }
            }

            // The complete React/Vite build is packaged with the APK.
            loadUrl("file:///android_asset/web/index.html")
        }

        editorWebView = webView
        setContentView(
            FrameLayout(this).apply {
                addView(
                    webView,
                    FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT
                    )
                )
            }
        )

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val current = editorWebView
                if (current?.canGoBack() == true) {
                    current.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    override fun onDestroy() {
        editorWebView?.apply {
            stopLoading()
            loadUrl("about:blank")
            removeAllViews()
            destroy()
        }
        editorWebView = null
        super.onDestroy()
    }
}
