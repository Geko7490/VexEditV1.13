package com.vexedit.studio

import com.vexedit.studio.engine.AudioEngine
import org.junit.Assert.assertEquals
import org.junit.Test

class AudioEngineTest {

    @Test
    fun testDbToLinear() {
        assertEquals(1.0f, AudioEngine.dbToLinear(0f), 0.001f)
        assertEquals(0.0f, AudioEngine.dbToLinear(-60f), 0.001f)
    }

    @Test
    fun testCalculateStereoPan() {
        val (centerL, centerR) = AudioEngine.calculateStereoPan(0f)
        assertEquals(1.0f, centerL, 0.001f)
        assertEquals(1.0f, centerR, 0.001f)

        val (leftL, leftR) = AudioEngine.calculateStereoPan(-1.0f)
        assertEquals(1.0f, leftL, 0.001f)
        assertEquals(0.0f, leftR, 0.001f)
    }

    @Test
    fun testCalculateFadeMultiplier() {
        val midFade = AudioEngine.calculateFadeMultiplier(
            currentSec = 1.0,
            clipStartSec = 0.0,
            clipDurationSec = 10.0,
            fadeInSec = 2.0,
            fadeOutSec = 2.0
        )
        assertEquals(0.5f, midFade, 0.01f)

        val fullSustain = AudioEngine.calculateFadeMultiplier(
            currentSec = 5.0,
            clipStartSec = 0.0,
            clipDurationSec = 10.0,
            fadeInSec = 2.0,
            fadeOutSec = 2.0
        )
        assertEquals(1.0f, fullSustain, 0.01f)
    }
}
