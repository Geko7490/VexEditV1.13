package com.vexedit.studio

import com.vexedit.studio.engine.TimecodeFormatter
import org.junit.Assert.assertEquals
import org.junit.Test

class TimecodeFormatterTest {

    @Test
    fun testFormatZeroSeconds() {
        assertEquals("00:00:00", TimecodeFormatter.formatSecondsToTimecode(0.0))
    }

    @Test
    fun testFormatRegularSeconds() {
        assertEquals("00:04:15", TimecodeFormatter.formatSecondsToTimecode(4.15))
        assertEquals("01:30:50", TimecodeFormatter.formatSecondsToTimecode(90.50))
    }

    @Test
    fun testParseTimecode() {
        assertEquals(4.15, TimecodeFormatter.parseTimecodeToSeconds("00:04:15"), 0.001)
        assertEquals(90.50, TimecodeFormatter.parseTimecodeToSeconds("01:30:50"), 0.001)
    }
}
