import java.util.Properties

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
        // Play: every upload needs a higher versionCode. 1.0.0 (1) = the first Google Play release.
        versionCode = 1
        versionName = "1.0.0"
        // Push (FCM) needs a Firebase project — off until the owner creates one (see data/Session.kt Push).
        buildConfigField("boolean", "PUSH_ENABLED", "false")
        // Buying in the app (Google Play Billing, billing/Store.kt): price gate, room offer, packs. -PpurchasesEnabled=false
        // hides every buy/pay screen (README "Payments and Google Play"); free codes, packs bought earlier and paid codes
        // keep working.
        val purchases = (project.findProperty("purchasesEnabled") as String?)?.toBooleanStrict() ?: true
        buildConfigField("boolean", "PURCHASES_ENABLED", purchases.toString())
    }

    // Release signing = the upload key, kept outside the repo: ~/.qrspace/android-upload.properties
    // (storeFile, storePassword, keyAlias, keyPassword), or another file via -PqrspaceSigning=/path, or the env vars
    // QRSPACE_UPLOAD_STORE_FILE / _STORE_PASSWORD / _KEY_ALIAS / _KEY_PASSWORD (CI). Without them the release
    // build is unsigned (Play won't take it). Google re-signs for users (Play App Signing).
    val signing = Properties().apply {
        val path = (project.findProperty("qrspaceSigning") as String?)
            ?: "${System.getProperty("user.home")}/.qrspace/android-upload.properties"
        val f = file(path)
        if (f.isFile) f.inputStream().use { load(it) }
        mapOf(
            "storeFile" to "QRSPACE_UPLOAD_STORE_FILE", "storePassword" to "QRSPACE_UPLOAD_STORE_PASSWORD",
            "keyAlias" to "QRSPACE_UPLOAD_KEY_ALIAS", "keyPassword" to "QRSPACE_UPLOAD_KEY_PASSWORD",
        ).forEach { (k, env) -> System.getenv(env)?.takeIf { it.isNotEmpty() }?.let { setProperty(k, it) } }
    }
    val canSign = listOf("storeFile", "storePassword", "keyAlias", "keyPassword").all { !signing.getProperty(it).isNullOrEmpty() }
    signingConfigs {
        if (canSign) create("upload") {
            storeFile = file(signing.getProperty("storeFile"))
            storePassword = signing.getProperty("storePassword")
            keyAlias = signing.getProperty("keyAlias")
            keyPassword = signing.getProperty("keyPassword")
        }
    }
    if (!canSign) logger.warn("QR Space: no upload key (~/.qrspace/android-upload.properties) — the release build will be unsigned.")

    // Server: release → https://qrspace.co. Debug → the local web server as the emulator sees it
    // (http://10.0.2.2:3720; cleartext only for 10.0.2.2/localhost, src/debug/res/xml/network_security_config.xml),
    // switchable at runtime in Account → Server. Override either with -PapiBase=…
    val apiBase = project.findProperty("apiBase") as String?
    buildTypes {
        debug {
            buildConfigField("String", "API_BASE", "\"${apiBase ?: "http://10.0.2.2:3720"}\"")
            // -PfakeStore=true: example prices and the site's demo payments instead of Google Play (billing/Store.kt) —
            // to test the purchase screens on an emulator. Never in release.
            buildConfigField("boolean", "FAKE_STORE", ((project.findProperty("fakeStore") as String?)?.toBooleanStrict() ?: false).toString())
        }
        release {
            buildConfigField("String", "API_BASE", "\"${apiBase ?: "https://qrspace.co"}\"")
            buildConfigField("boolean", "FAKE_STORE", "false")
            isMinifyEnabled = true
            isShrinkResources = true
            if (canSign) signingConfig = signingConfigs.getByName("upload")
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
    implementation(libs.billing.ktx)

    testImplementation(libs.junit)
}
