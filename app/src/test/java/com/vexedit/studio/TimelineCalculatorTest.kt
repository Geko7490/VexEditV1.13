package com.vexedit.studio

import com.vexedit.studio.engine.TimelineCalculator
import com.vexedit.studio.model.ClipData
import com.vexedit.studio.model.TrackType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class TimelineCalculatorTest {

    @Test
    fun testCalculateTotalDuration() {
        val clips = listOf(
            ClipData(id = "c1", trackId = 1, type = TrackType.VIDEO, name = "Clip 1", start = 0.0, duration = 5.0),
            ClipData(id = "c2", trackId = 1, type = TrackType.VIDEO, name = "Clip 2", start = 4.0, duration = 8.5)
        )
        val duration = TimelineCalculator.calculateTotalDuration(clips)
        assertEquals(12.5, duration, 0.001)
    }

    @Test
    fun testGetActiveClipsAt() {
        val clips = listOf(
            ClipData(id = "c1", trackId = 1, type = TrackType.VIDEO, name = "Clip 1", start = 0.0, duration = 5.0),
            ClipData(id = "c2", trackId = 2, type = TrackType.AUDIO, name = "Audio 1", start = 2.0, duration = 6.0)
        )
        val activeAt3 = TimelineCalculator.getActiveClipsAt(clips, 3.0)
        assertEquals(2, activeAt3.size)

        val activeAt6 = TimelineCalculator.getActiveClipsAt(clips, 6.0)
        assertEquals(1, activeAt6.size)
        assertEquals("c2", activeAt6[0].id)
    }

    @Test
    fun testSplitClipValid() {
        val clip = ClipData(id = "c1", trackId = 1, type = TrackType.VIDEO, name = "Clip 1", start = 2.0, duration = 6.0)
        val splitResult = TimelineCalculator.splitClip(clip, 5.0, "c1_part2")
        assertNotNull(splitResult)
        val (first, second) = splitResult!!
        assertEquals("c1", first.id)
        assertEquals(2.0, first.start, 0.001)
        assertEquals(3.0, first.duration, 0.001)

        assertEquals("c1_part2", second.id)
        assertEquals(5.0, second.start, 0.001)
        assertEquals(3.0, second.duration, 0.001)
    }

    @Test
    fun testSplitClipOutOfBounds() {
        val clip = ClipData(id = "c1", trackId = 1, type = TrackType.VIDEO, name = "Clip 1", start = 2.0, duration = 6.0)
        assertNull(TimelineCalculator.splitClip(clip, 2.01, "c1_p2"))
        assertNull(TimelineCalculator.splitClip(clip, 7.99, "c1_p2"))
    }

    @Test
    fun testCalculateTotalFrames() {
        assertEquals(150L, TimelineCalculator.calculateTotalFrames(5.0, 30))
        assertEquals(300L, TimelineCalculator.calculateTotalFrames(5.0, 60))
        assertEquals(0L, TimelineCalculator.calculateTotalFrames(0.0, 30))
    }
}
