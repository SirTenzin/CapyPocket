# Capy Pocket

Personal iPhone webview wrapper for https://capy.ai. Built with Expo SDK 55 and React Native WebView. Not an official Capy app. SDK 55 supports Xcode 26+, including the owner's installed Xcode 26.1.1.

The iOS app icon is rendered from Capy's official dark-mode favicon SVG at https://capy.ai/_marketing/favicon/favicon.svg, centered on an opaque black 1024×1024 canvas. The Capy logo belongs to its respective owner; its use here does not imply endorsement.

## Run on iPhone

```
npm ci
npx expo login --browser
npx expo start --tunnel
```

Use an installed development build, or Expo Go supporting SDK 55. The current App Store Expo Go may not support this older SDK. Robot tokens cannot start Expo's ngrok tunnel. If an EXPO_TOKEN environment variable points to a robot, unset it for these commands so the browser-login session is used. Authentication credentials are not included in this project.

## Behavior

- Loads Capy's real sign-in page, with normal persistent webview cookies. OAuth navigations are allowed over HTTPS; popup requests open in the same webview. External providers may reject embedded sign-in. Email sign-in is available on Capy's page.
- When Capy's authenticated sidebar shell is present, the webview extends behind the status bar. The real webpage paints the top area, including live dither, custom images, overlay shading, and the mobile sidebar. No background is cloned or approximated with a single color. The native top safe inset is passed to Capy's --safe-top. On /new, padding is moved inside the homepage surface so its absolutely positioned background reaches the top, while the navigation button stays below the notch. This uses verified public data-slot hooks and the homepage top-control class; future Capy layout changes may require adjustment.
- Sign-in and external authentication pages retain the native top spacer. Its background and status text contrast use sampled colors. A one-pixel canvas converts OKLCH/color-mix to sRGB and composites transparent ancestors; it does not screenshot shader pixels. This sampling no longer paints a flat strip over the authenticated home/sidebar backgrounds.
- No native bottom padding or automatic content insets are added. --safe-bottom remains 12px after device feedback, giving the existing chat footer 16px including its own 4px. Real-device validation is required to check home-indicator and keyboard clearance.
- iOS Text Size is bridged to CSS text-size-adjust without replacing font families, root font size, or page zoom. It is not UIKit's per-style Dynamic Type sizing curve. Inputs, textareas, and contenteditable regions receive the same scaling as surrounding text.
- A document-start viewport guard adds maximum-scale=1 while retaining Capy's other viewport settings and repairing replacements. This is intended to suppress the focus zoom reintroduced by smaller editable text. WKWebView's default scale-limit handling is retained; intentional pinch enlargement is restricted as well. No keyboard-height calculations or forced scrolling are introduced. Actual focus behavior must be verified on iPhone.
- The browser input accessory bar is hidden. WebKit keyboard handling is retained; there is no KeyboardAvoidingView, forced scrolling, or page reload when system text size changes.
- Injection and accepted color messages are restricted to the exact HTTPS capy.ai origin and the top frame. HTTPS auth pages remain unmodified. Only validated colors cross the native message bridge; no credentials or page text are read.

## Native iOS builds

The project is linked to `@tanvir_autumn/capy-pocket` on EAS. Before the first device build, configure Apple signing and ensure the intended iPhone is registered with the chosen Apple team.

```
npx eas-cli device:create
npx eas-cli build --platform ios --profile development
```

The development profile includes `expo-dev-client` and needs a running development server (`npx expo start --dev-client --tunnel`). For a standalone app with the JavaScript bundle included and no development-server dependency, use `--profile preview` instead. Both profiles use internal distribution and require registered iPhones. Apple signing is not yet configured for this bundle ID.

## Validation

```
npx tsc --noEmit
npx playwright install chromium
npx tsx --test tests/*.test.ts
npx expo export --platform ios --platform web
```

Tests cover origin/navigation guards, invalid bridge messages, font and draft preservation, editor scaling, preservation of other viewport settings, viewport replacement, repeated text-size updates, modern color and transparency conversion, reduced safe-area padding, stylesheet restoration, and no injection on external pages. An edge-layout fixture verifies live canvas identity, two background colors, partial sidebar coverage, protected control positions, route changes, and fallback when the shell is absent. Browser tests are not proof of iOS layout or scaling behavior. Fixture screenshots are explicitly not real Capy/iPhone screenshots.

The desktop preview is an explanatory screen, not a simulation of WKWebView. The actual Capy sign-in page was also visually inspected with the bridge injected in a mobile-size Chromium browser.

## Device acceptance checks

1. Sign in and reopen the app to verify the session persists.
2. Open a chat. Compare smallest/default Text Size using Control Center's Expo Go Only setting; preserve the Capy font.
3. Open and dismiss the keyboard, including a multiline draft. Confirm the composer remains visible and no new bottom gap appears.
4. Check the home indicator does not cover controls with the reduced safe-bottom spacer.
5. Change Capy theme and navigate between screens. Confirm top background and status icons follow it.
6. Check streaming, attachments, external sign-in, and navigation gestures.

The authenticated chat UI cannot be validated without the user's login on their iPhone. Capy's public CSS and thread-view bundle confirm the composer container adds --safe-bottom to its padding. Removing this known contributor still needs device verification. No HDR, outdoor-contrast, or push-notification feature has been added.

Source repository: https://github.com/SirTenzin/CapyPocket. The iOS bundle identifier is `rip.ami.capy.pocket`. Development tunnels require a running machine and may stop when it sleeps; an independently installed IPA is a separate delivery step.
