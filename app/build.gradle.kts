plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val npmExecutable = if (System.getProperty("os.name").lowercase().contains("windows")) "npm.cmd" else "npm"
val webAssetsDirectory = layout.projectDirectory.dir("src/main/assets/web")

// Build the existing React editor and package the complete Vite output into the APK.
// This makes the app launch offline instead of showing a separate placeholder screen.
tasks.register("buildWebEditor") {
    inputs.files(
        rootProject.fileTree("src"),
        rootProject.file("index.html"),
        rootProject.file("package.json"),
        rootProject.file("package-lock.json"),
        rootProject.file("vite.config.ts"),
        rootProject.file("tsconfig.json")
    )
    outputs.dir(webAssetsDirectory)

    doLast {
        exec {
            workingDir(rootProject.projectDir)
            commandLine(npmExecutable, "ci")
        }
        exec {
            workingDir(rootProject.projectDir)
            commandLine(npmExecutable, "run", "build")
        }
        copy {
            from(rootProject.file("dist"))
            into(webAssetsDirectory)
        }
        check(file("src/main/assets/web/index.html").isFile) {
            "VexEdit web editor build did not produce app/src/main/assets/web/index.html"
        }
    }
}

tasks.named("preBuild").configure {
    dependsOn("buildWebEditor")
}

android {
    namespace = "com.vexedit.studio"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.vexedit.studio"
        minSdk = 24
        targetSdk = 34
        versionCode = 2
        versionName = "1.2.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        getByName("debug") {
            isMinifyEnabled = false
        }
        getByName("release") {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    buildFeatures {
        compose = false
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.0")
    implementation("androidx.webkit:webkit:1.11.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
    androidTestImplementation("androidx.test.ext:junit:1.2.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.6.0")
}
