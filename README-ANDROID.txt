P-12 Android wrapper

Goals of this Android port:
- Keep the same P-12 sampler/sequencer/audio/export code.
- Keep Tune BF / Tune AT and SP12/HFE export logic unchanged.
- Keep horizontal + vertical scrolling across the workstation UI.
- Keep pinch zoom enabled in the Android WebView.
- Keep Android file import via the system file picker.
- Save browser blob downloads to Downloads/P-12 through the native bridge.
- Desktop VST/VST3 hosting is intentionally not supported in Android.

Build requirements:
- Android SDK 35
- Android Build Tools for SDK 35
- Gradle / Android Gradle Plugin as declared by this project
- JDK 17+ supported by the selected AGP

Open this folder in Android Studio and build app-debug.apk.
