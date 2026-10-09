plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.ksp)
}

android {
    namespace = "co.qrspace.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "co.qrspace.app"
        minSdk = 26
        targetSdk = 36
        versionCode = 2
        versionName = "1.1.0"
        // Push (FCM) needs a Firebase project — off until the owner creates one (see data/Session.kt Push).
        buildConfigField("boolean", "PUSH_ENABLED", "false")
    }

    // Server: release → https://qrspace.co. Debug → the local web server as the emulator sees it
    // (http://10.0.2.2:3720; cleartext only for 10.0.2.2/localhost, src/debug/res/xml/network_security_config.xml),
    // switchable at runtime in Account → Server. Override either with -PapiBase=…
    val apiBase = project.findProperty("apiBase") as String?
    buildTypes {
        debug {
            buildConfigField("String", "API_BASE", "\"${apiBase ?: "http://10.0.2.2:3720"}\"")
        }
        release {
            buildConfigField("String", "API_BASE", "\"${apiBase ?: "https://qrspace.co"}\"")
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
    androidResources {
        // Only the seven languages the site has.
        localeFilters += listOf("en", "ru", "hy", "es", "pt", "fr", "de")
    }
    lint {
        abortOnError = false
        checkReleaseBuilds = false
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

ksp {
    arg("room.schemaLocation", "$projectDir/schemas")
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.navigation.compose)

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.ui.graphics)
    implementation(libs.compose.ui.tooling.preview)
    implementation(libs.compose.material3)
    implementation(libs.compose.material.icons)
    debugImplementation(libs.compose.ui.tooling)

    implementation(libs.camera.core)
    implementation(libs.camera.camera2)
    implementation(libs.camera.lifecycle)
    implementation(libs.camera.view)
    implementation(libs.mlkit.barcode)

    implementation(libs.room.runtime)
    implementation(libs.room.ktx)
    ksp(libs.room.compiler)

    implementation(libs.okhttp)
    implementation(libs.kotlinx.serialization.json)
    implementation(libs.coil.compose)
    implementation(libs.coil.okhttp)
    implementation(libs.coil.svg)
    implementation(libs.androidx.browser)
    implementation(libs.media3.exoplayer)
    implementation(libs.media3.ui)
    implementation(libs.media3.okhttp)
    implementation(libs.zxing.core)

    testImplementation(libs.junit)
}
