package com.vexedit.studio.model

enum class TrackType {
    VIDEO,
    AUDIO,
    OVERLAY,
    TEXT
}

enum class AspectRatio(val label: String, val width: Int, val height: Int) {
    RATIO_9_16("9:16", 1080, 1920),
    RATIO_16_9("16:9", 1920, 1080),
    RATIO_1_1("1:1", 1080, 1080);

    companion object {
        fun fromLabel(label: String): AspectRatio =
            entries.find { it.label == label } ?: RATIO_16_9
    }
}

data class ClipData(
    val id: String,
    val trackId: Int,
    val type: TrackType,
    val name: String,
    val start: Double,
    val duration: Double,
    val color: String = "#8b67f7",
    val opacity: Float = 1.0f,
    val speed: Float = 1.0f,
    val reversed: Boolean = false,
    val frozen: Boolean = false,
    val volume: Float = 1.0f,
    val effects: List<String> = emptyList(),
    val textContent: String = "",
    val scale: Float = 1.0f,
    val rotation: Float = 0.0f
)

data class TrackData(
    val id: Int,
    val name: String,
    val type: TrackType,
    val muted: Boolean = false,
    val locked: Boolean = false,
    val volume: Float = 1.0f
)

data class ProjectData(
    val id: String,
    val name: String,
    val aspectRatio: AspectRatio = AspectRatio.RATIO_16_9,
    val fps: Int = 30,
    val resolution: String = "1920x1080",
    val tracks: List<TrackData> = emptyList(),
    val clips: List<ClipData> = emptyList(),
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis()
)
