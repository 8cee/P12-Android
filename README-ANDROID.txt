P-12 FULL15 Android 1.0.8 — smartphone edition

Base: P12_FULL15_WINDOWS_MAX_BUILD_FIX_2026-10-11(1).zip supplied by the user.
FULL15_SOURCE.json records exact source hashes. P-12.html is unchanged except
for the two Android CSS/JS links in its head. Audio, project, SP12 and HFE
conversion code is retained from that exact package.

PHONE INTERFACE
- Top tabs: Pads, Sequencer, Mixer, FX, Song.
- Eight large pads in a 4 x 2 performance grid; Edit pads reveals sample-load,
  reverse, slice, warp and trim controls in wider touch-edit cards.
- Play / Stop / Pad Rec remain at the bottom. BPM, Tap and banks stay accessible.
- Project/sequence and sample tools expand separately.
- Portrait and landscape layouts, in-app Rotate, pinch zoom and timeline scroll.
- Mixer-32 opens as an on-device dialog with master and horizontally scrollable
  channel strips. Playlist uses the FULL15 dialog with per-clip ranges.
- Existing P-12 launcher icon retained. Fullscreen hides Android system bars;
  an edge swipe can reveal them temporarily, as required by Android.

ANDROID INTEGRATION
- Local bundled HTML/JS sampler in an installable Android app; no website needed.
- WebAudio engine and built-in effects. The Windows JUCE/VST2/VST3 host and
  Electron detached windows do not run on Android. Desktop native timing and
  Ozone changes therefore are not Android native-audio features.
- Project.p12, sample import, SP12/HFE and WAV/ZIP use system file handling.
- Exports stream through small chunks into temporary files, without additional
  whole-file base64 copies. Android 10+ saves to Downloads/P-12; Android 8/9
  uses a system Save dialog. Maximum single bridge export: 512 MiB.
- Microphone access waits for Android permission approval.
- Back closes the current dialog/page, then asks before exiting.

BUILD
JDK 17, Android SDK 35, Gradle 8.9, Android Gradle Plugin 8.7.3.
  gradle --no-daemon :app:assembleDebug :app:lintDebug
APK: app/build/outputs/apk/debug/app-debug.apk
The supplied APK is debug signed for direct testing, not a Play Store release.
An older APK signed with a different key cannot be updated in place. Keep your
Project.p12 exports before removing an older installation if Android requires it.

VALIDATION (2026-10-19)
- assembleDebug and lintDebug pass (remaining nonfatal platform/icon warnings).
- APK v2 signature verified.
- Phone-sized Chromium smoke test: portrait/landscape fit, touch pad release,
  sample WAV import, Play/Stop, sequencer zoom/scroll, mixer master, playlist,
  FX, Project.p12 save/reload and byte-exact multi-chunk download.
- Exact uploaded FULL15 source hashes verified.
- HFE synthetic tests: 32 pad identities, four audio pages, overlaps, CRCs and
  OS preservation; source SP12 image unchanged.
- Physical Android audio latency, microphone capture, OS file dialogs and
  Rossum hardware roundtrip have not been tested on a real device here.

TESTS
  node tests/full15-integrity.cjs
  (from app/src/main/assets) node ../../../../tests/hfe-hardware-layout.cjs
  P12_CHROMIUM=/path/to/chromium node tests/android-smoke.cjs
The browser test requires Playwright and uses a simulated JavaScript bridge;
it does not replace testing the APK on Android.

1.0.5 startup correction: fullscreen is requested after setContentView, and
the initialized decor view is used for the insets controller. This removes
the pre-decor null dereference on Android 11+. Build/lint verified; launch on
the reporting phone remains to be confirmed.

1.0.6 phone navigation:
- Unlock vertical sequencer scrolling; compact header/help; step paging arrows.
- Mixer channel selector with all 32 pads, master, instrument/sequence tracks and buses.
- Single vertical mixer scroll, faders first, larger touch targets.
- Browser touch-drag and channel navigation checks pass; Android build/lint pass. Physical device verification pending.

1.0.7 universal phone zoom:
- Shared 50-175% layout zoom controls on every main screen and dialog, saved locally.
- Allow native pinch gestures through mixer, knobs, faders and editors.
- Scroll overflowing FX and song panels; dialogs scale independently from workspace.
- Browser zoom/scroll checks and Android build/lint; physical phone verification pending.

1.0.8 simplified phone workflow:
- Eight visible step columns with paging and playhead follow; all eight pad rows fit the tested 390x844 screen.
- Four mixer faders at a time with A/B/C/D/Tracks/Master/Buses tabs. More reveals the original advanced channel controls.
- Remove screen zoom toolbars; fit by default, pinch enlarges and returns to fit without shrinking into a tiny strip.
- Sequencer editing, touch faders, mute, project save/load, portrait/landscape, native pinch and original FULL15 integrity checked in browser tests.
- Android build/lint passed; physical phone verification pending.
