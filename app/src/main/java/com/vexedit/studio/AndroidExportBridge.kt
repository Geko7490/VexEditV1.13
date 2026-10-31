package com.vexedit.studio

import android.app.Activity
import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import android.webkit.JavascriptInterface
import android.widget.Toast
import java.io.File
import java.io.FileOutputStream
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/**
 * Chunked bridge for saving large rendered videos without sending a huge
 * base64 string through a single JavaScript interface call.
 */
class AndroidExportBridge(private val activity: Activity) {
    private data class PendingExport(
        val file: File,
        val fileName: String,
        val mimeType: String,
        val expectedBytes: Long
    )

    private val pending = ConcurrentHashMap<String, PendingExport>()
    private val ioExecutor = Executors.newSingleThreadExecutor()

    @JavascriptInterface
    fun isAvailable(): Boolean = true

    @JavascriptInterface
    fun finishApp() {
        activity.runOnUiThread { activity.finish() }
    }

    @JavascriptInterface
    fun beginSave(fileName: String, mimeType: String, expectedBytes: Long): String {
        return try {
            val safeName = fileName.replace(Regex("[^A-Za-z0-9._-]"), "_").ifBlank { "VexEdit_Export.webm" }
            val token = UUID.randomUUID().toString()
            val tempFile = File(activity.cacheDir, "vexedit_export_$token.tmp")
            tempFile.outputStream().use { }
            pending[token] = PendingExport(tempFile, safeName, mimeType.ifBlank { "video/webm" }, expectedBytes)
            token
        } catch (error: Exception) {
            android.util.Log.e("VexEditExport", "Could not begin export save", error)
            ""
        }
    }

    @JavascriptInterface
    fun appendSaveChunk(token: String, base64Chunk: String): Boolean {
        val export = pending[token] ?: return false
        return try {
            val bytes = Base64.decode(base64Chunk, Base64.NO_WRAP)
            FileOutputStream(export.file, true).use { it.write(bytes) }
            true
        } catch (error: Exception) {
            android.util.Log.e("VexEditExport", "Could not write export chunk", error)
            false
        }
    }

    @JavascriptInterface
    fun finishSave(token: String): Boolean {
        val export = pending.remove(token) ?: return false
        ioExecutor.execute {
            try {
                if (export.expectedBytes > 0 && export.file.length() != export.expectedBytes) {
                    throw IllegalStateException("Export size verification failed.")
                }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val values = ContentValues().apply {
                        put(MediaStore.Video.Media.DISPLAY_NAME, export.fileName)
                        put(MediaStore.Video.Media.MIME_TYPE, export.mimeType)
                        put(MediaStore.Video.Media.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/VexEdit")
                        put(MediaStore.Video.Media.IS_PENDING, 1)
                    }
                    val uri = activity.contentResolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
                        ?: throw IllegalStateException("Android could not create the video in Movies/VexEdit.")
                    try {
                        activity.contentResolver.openOutputStream(uri, "w").use { output ->
                            if (output == null) throw IllegalStateException("Could not open the output video.")
                            export.file.inputStream().use { input -> input.copyTo(output) }
                        }
                        val complete = ContentValues().apply {
                            put(MediaStore.Video.Media.IS_PENDING, 0)
                        }
                        activity.contentResolver.update(uri, complete, null, null)
                    } catch (error: Exception) {
                        activity.contentResolver.delete(uri, null, null)
                        throw error
                    }
                } else {
                    val directory = File(
                        activity.getExternalFilesDir(Environment.DIRECTORY_MOVIES),
                        "VexEdit"
                    )
                    if (!directory.exists() && !directory.mkdirs()) {
                        throw IllegalStateException("Could not create the VexEdit export folder.")
                    }
                    export.file.copyTo(File(directory, export.fileName), overwrite = true)
                }

                export.file.delete()
                activity.runOnUiThread {
                    Toast.makeText(activity, "Video saved to Movies/VexEdit", Toast.LENGTH_LONG).show()
                }
            } catch (error: Exception) {
                android.util.Log.e("VexEditExport", "Export save failed", error)
                export.file.delete()
                activity.runOnUiThread {
                    Toast.makeText(
                        activity,
                        "Could not save video: ${error.localizedMessage ?: "Unknown error"}",
                        Toast.LENGTH_LONG
                    ).show()
                }
            }
        }
        return true
    }

    @JavascriptInterface
    fun cancelSave(token: String) {
        pending.remove(token)?.file?.delete()
    }
}
