# R8 (release: minify + shrink resources). Libraries ship their own consumer rules too (kotlinx.serialization, Room,
# ML Kit, CameraX, OkHttp, Coil, Media3); these are the app's own on top. Checked on the release APK against
# qrspace.co: scanner (ML Kit, camera and photo), scan history (Room), sign-in, home, create, edit (JSON models).

# Readable stack traces in Play Console (the AAB carries the mapping file; Play de-obfuscates with it).
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# kotlinx.serialization: our @Serializable models (data/Models.kt …) and their generated serializers.
-keepattributes *Annotation*, InnerClasses, Signature
-dontnote kotlinx.serialization.**
-keepclassmembers @kotlinx.serialization.Serializable class co.qrspace.app.** {
    *** Companion;
    kotlinx.serialization.KSerializer serializer(...);
}
-keep,includedescriptorclasses class co.qrspace.app.**$$serializer { *; }
-if @kotlinx.serialization.Serializable class co.qrspace.app.**
-keepclassmembers class <1> {
    static <1>$Companion Companion;
}

# Room: the generated database is created by name (AppDb_Impl); the entity is read by generated code.
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep @androidx.room.Entity class co.qrspace.app.** { *; }

# ML Kit barcode (bundled model): native methods keep their names (JNI). Its model protos (read by reflection) are
# kept by the library's own proguard.txt — their obfuscated names change between versions, so not repeated here.
-keepclasseswithmembernames class * {
    native <methods>;
}
-dontwarn com.google.mlkit.**
