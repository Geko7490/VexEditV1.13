# Proguard rules for VexEdit Studio

# Keep Compose and Kotlin rules
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable

# Kotlin Coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}

# AndroidX Navigation
-keepclassmembers class * extends androidx.navigation.Navigator {
    public <init>(...);
}

# Room
-keep class * extends androidx.room.RoomDatabase
-dontwarn androidx.room.paging.**

# Coil
-dontwarn io.coil.**
-keep class io.coil.** { *; }