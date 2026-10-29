# ProGuard rules for SilentSOS Android
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep WebKit and AndroidX components
-keepclassmembers class fqcn.of.javascript.interface.for.webview {
   public *;
}
