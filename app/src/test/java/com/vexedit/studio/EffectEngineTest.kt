package com.vexedit.studio

import com.vexedit.studio.engine.EffectEngine
import com.vexedit.studio.engine.KeyframePoint
import org.junit.Assert.assertEquals
import org.junit.Test

class EffectEngineTest {

    @Test
    fun testInterpolateKeyframes() {
        val keyframes = listOf(
            KeyframePoint(timeSec = 0.0, value = 0.0f),
            KeyframePoint(timeSec = 10.0, value = 100.0f)
        )

        assertEquals(0.0f, EffectEngine.interpolateKeyframes(keyframes, 0.0), 0.001f)
        assertEquals(50.0f, EffectEngine.interpolateKeyframes(keyframes, 5.0), 0.001f)
        assertEquals(100.0f, EffectEngine.interpolateKeyframes(keyframes, 10.0), 0.001f)
        assertEquals(100.0f, EffectEngine.interpolateKeyframes(keyframes, 15.0), 0.001f)
    }

    @Test
    fun testClampParam() {
        assertEquals(50f, EffectEngine.clampParam(50f, 0f, 100f), 0.001f)
        assertEquals(0f, EffectEngine.clampParam(-10f, 0f, 100f), 0.001f)
        assertEquals(100f, EffectEngine.clampParam(120f, 0f, 100f), 0.001f)
    }
}
