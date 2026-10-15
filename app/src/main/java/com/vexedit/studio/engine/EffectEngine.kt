package com.vexedit.studio.engine

data class KeyframePoint(val timeSec: Double, val value: Float)

object EffectEngine {

    fun interpolateKeyframes(keyframes: List<KeyframePoint>, currentTimeSec: Double, defaultValue: Float = 0f): Float {
        if (keyframes.isEmpty()) return defaultValue
        if (keyframes.size == 1) return keyframes.first().value

        val sorted = keyframes.sortedBy { it.timeSec }
        if (currentTimeSec <= sorted.first().timeSec) return sorted.first().value
        if (currentTimeSec >= sorted.last().timeSec) return sorted.last().value

        for (i in 0 until sorted.size - 1) {
            val p0 = sorted[i]
            val p1 = sorted[i + 1]
            if (currentTimeSec >= p0.timeSec && currentTimeSec <= p1.timeSec) {
                val span = p1.timeSec - p0.timeSec
                if (span <= 0.0001) return p0.value
                val factor = ((currentTimeSec - p0.timeSec) / span).toFloat()
                return p0.value + factor * (p1.value - p0.value)
            }
        }
        return defaultValue
    }

    fun clampParam(value: Float, min: Float, max: Float): Float {
        return value.coerceIn(min, max)
    }
}
