package com.vexedit.studio

import android.app.Application

class VexEditApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Offline-first: no network required for core features.
    }
}