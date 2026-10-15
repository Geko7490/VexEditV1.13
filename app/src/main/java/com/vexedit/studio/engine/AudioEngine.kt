package com.vexedit.studio.engine

import kotlin.math.pow

object AudioEngine {

    fun dbToLinear(dB: Float): Float {
        if (dB <= -60f) return 0f
        return 10.0.pow(dB / 20.0).toFloat()
    }

    fun linearToDb(linear: Float): Float {
        if (linear <= 0.0001f) return -60f
        return (20.0 * kotlin.math.log10(linear.toDouble())).toFloat().coerceIn(-60f, 24f)
    }

    fun calculateStereoPan(pan: Float): Pair<Float, Float> {
        val clampedPan = pan.coerceIn(-1.0f, 1.0f)
        val left = (1.0f - clampedPan).coerceIn(0f, 1f)
        val right = (1.0f + clampedPan).coerceIn(0f, 1f)
        return Pair(left, right)
    }

    fun calculateFadeMultiplier(
        currentSec: Double,
        clipStartSec: Double,
        clipDurationSec: Double,
        fadeInSec: Double,
        fadeOutSec: Double
    ): Float {
        val relTime = currentSec - clipStartSec
        if (relTime < 0.0 || relTime > clipDurationSec) return 0f

        var mult = 1.0f
        if (fadeInSec > 0.0 && relTime < fadeInSec) {
            mult *= (relTime / fadeInSec).toFloat().coerceIn(0f, 1f)
        }
        val remaining = clipDurationSec - relTime
        if (fadeOutSec > 0.0 && remaining < fadeOutSec) {
            mult *= (remaining / fadeOutSec).toFloat().coerceIn(0f, 1f)
        }
        return mult
    }
}
