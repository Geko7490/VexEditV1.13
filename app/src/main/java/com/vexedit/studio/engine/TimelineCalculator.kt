package com.vexedit.studio.engine

import com.vexedit.studio.model.ClipData
import com.vexedit.studio.model.ProjectData

object TimelineCalculator {

    fun calculateTotalDuration(clips: List<ClipData>): Double {
        if (clips.isEmpty()) return 0.0
        return clips.maxOfOrNull { it.start + it.duration } ?: 0.0
    }

    fun getActiveClipsAt(clips: List<ClipData>, timeSec: Double): List<ClipData> {
        return clips.filter { timeSec >= it.start && timeSec < (it.start + it.duration) }
    }

    fun splitClip(clip: ClipData, splitTimeSec: Double, newId: String): Pair<ClipData, ClipData>? {
        val relTime = splitTimeSec - clip.start
        if (relTime <= 0.05 || relTime >= (clip.duration - 0.05)) {
            return null
        }
        val firstPart = clip.copy(duration = relTime)
        val secondPart = clip.copy(
            id = newId,
            start = clip.start + relTime,
            duration = clip.duration - relTime
        )
        return Pair(firstPart, secondPart)
    }

    fun calculateTotalFrames(durationSec: Double, fps: Int): Long {
        if (durationSec <= 0.0 || fps <= 0) return 0L
        return kotlin.math.round(durationSec * fps).toLong()
    }
}
