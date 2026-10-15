package com.vexedit.studio.engine

object TimecodeFormatter {

    fun formatSecondsToTimecode(seconds: Double): String {
        if (seconds.isNaN() || seconds.isInfinite() || seconds < 0.0) {
            return "00:00:00"
        }
        val totalSec = seconds.toInt()
        val minutes = totalSec / 60
        val remainingSec = totalSec % 60
        val centiseconds = ((seconds - totalSec) * 100).toInt().coerceIn(0, 99)
        return String.format("%02d:%02d:%02d", minutes, remainingSec, centiseconds)
    }

    fun parseTimecodeToSeconds(timecode: String): Double {
        val parts = timecode.split(":")
        if (parts.size != 3) return 0.0
        val minutes = parts[0].toIntOrNull() ?: 0
        val seconds = parts[1].toIntOrNull() ?: 0
        val centiseconds = parts[2].toIntOrNull() ?: 0
        return (minutes * 60.0) + seconds.toDouble() + (centiseconds / 100.0)
    }
}
