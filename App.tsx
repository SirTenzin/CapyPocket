import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';
import { makePageBridge, makeViewportGuard } from './src/pageBridge';
import { isCapyUrl, parseColors, permittedNavigation } from './src/policy';

const HOME = 'https://capy.ai/sign-in';

function CapyShell() {
  const webview = useRef<WebView>(null);
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [source, setSource] = useState(HOME);
  const [colors, setColors] = useState({ top: '#0c090b', bottom: '#0c090b', lightText: true, edgeToEdge: false });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    webview.current?.injectJavaScript(makePageBridge(fontScale, insets.top));
  }, [fontScale, insets.top]);

  const openWindow = (url: string) => {
    if (permittedNavigation(url) === 'web') setSource(url);
    else if (permittedNavigation(url) === 'external') void Linking.openURL(url).catch(() => {});
  };

  if (Platform.OS === 'web') {
    return <View style={styles.fallback}>
      <Text style={styles.heading}>Capy Pocket</Text>
      <Text style={styles.explanation}>A personal iPhone wrapper for Capy. Open the Expo QR code on your iPhone to use the real WebKit view, your saved login, and system Text Size.</Text>
      <Text style={styles.explanation}>No separate chat interface. No permanent toolbar. Your existing Capy, with a native frame.</Text>
    </View>;
  }

  return <View style={{ flex: 1, backgroundColor: colors.bottom }}>
    <StatusBar style={colors.lightText ? 'light' : 'dark'} />
    <View style={{ height: colors.edgeToEdge ? 0 : insets.top, backgroundColor: colors.top }} />
    <View style={{ flex: 1, marginLeft: insets.left, marginRight: insets.right }}>
      <WebView
        ref={webview}
        source={{ uri: source }}
        style={{ flex: 1, backgroundColor: colors.bottom }}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(request) => {
          const policy = permittedNavigation(request.url);
          if (policy === 'external') void Linking.openURL(request.url).catch(() => {});
          return policy === 'web';
        }}
        onOpenWindow={({ nativeEvent }) => openWindow(nativeEvent.targetUrl)}
        injectedJavaScriptBeforeContentLoaded={makeViewportGuard()}
        injectedJavaScript={makePageBridge(fontScale, insets.top)}
        onMessage={({ nativeEvent }) => {
          if (!isCapyUrl(nativeEvent.url)) return;
          const next = parseColors(nativeEvent.data);
          if (next) setColors(next);
        }}
        onLoadStart={() => { setLoading(true); setFailed(false); setColors(previous => ({ ...previous, edgeToEdge: false })); }}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setFailed(true); }}
        onContentProcessDidTerminate={() => webview.current?.reload()}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        automaticallyAdjustsScrollIndicatorInsets={false}
        hideKeyboardAccessoryView
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        setSupportMultipleWindows={false}
      />
      {loading && <View pointerEvents="none" style={styles.loading}><ActivityIndicator color={colors.lightText ? '#eee' : '#222'} /></View>}
      {failed && <View style={[styles.error, { backgroundColor: colors.bottom }]}>
        <Text style={[styles.heading, { color: colors.lightText ? '#eee' : '#222' }]}>Couldn’t load Capy</Text>
        <Pressable accessibilityRole="button" style={styles.retry} onPress={() => { setFailed(false); webview.current?.reload(); }}><Text style={styles.retryText}>Try again</Text></Pressable>
      </View>}
    </View>
  </View>;
}

export default function App() { return <SafeAreaProvider><CapyShell /></SafeAreaProvider>; }

const styles = StyleSheet.create({
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#0c090b' },
  heading: { fontSize: 28, fontWeight: '600', color: '#eee', marginBottom: 18 },
  explanation: { color: '#bbb', fontSize: 17, lineHeight: 26, maxWidth: 440, marginBottom: 18 },
  loading: { position: 'absolute', top: 12, right: 16, padding: 8, borderRadius: 20, backgroundColor: '#77777733' },
  error: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', padding: 24 },
  retry: { backgroundColor: '#d76d91', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14 },
  retryText: { color: '#160a10', fontSize: 17, fontWeight: '600' },
});
