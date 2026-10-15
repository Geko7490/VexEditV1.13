package com.vexedit.studio

import com.vexedit.studio.model.AspectRatio
import com.vexedit.studio.model.ProjectData
import org.junit.Assert.assertEquals
import org.junit.Test

class ProjectModelTest {

    @Test
    fun testAspectRatioFromLabel() {
        assertEquals(AspectRatio.RATIO_9_16, AspectRatio.fromLabel("9:16"))
        assertEquals(AspectRatio.RATIO_16_9, AspectRatio.fromLabel("16:9"))
        assertEquals(AspectRatio.RATIO_1_1, AspectRatio.fromLabel("1:1"))
        assertEquals(AspectRatio.RATIO_16_9, AspectRatio.fromLabel("unknown"))
    }

    @Test
    fun testProjectDefaults() {
        val proj = ProjectData(id = "p1", name = "Test Project")
        assertEquals(30, proj.fps)
        assertEquals("1920x1080", proj.resolution)
        assertEquals(0, proj.clips.size)
    }
}
