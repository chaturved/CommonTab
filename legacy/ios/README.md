# iOS app

Open `CommonTab.xcodeproj` in Xcode and run the `CommonTab` scheme. The Swift package in this directory exposes core logic for fast tests without launching a simulator.

From the repository root:

```sh
swift test --package-path apps/ios
xcodebuild -project apps/ios/CommonTab.xcodeproj -scheme CommonTab \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

`CommonTab/` contains the app source, `CommonTabTests/` contains core tests, and `CommonTabUITests/` contains simulator flows. Keep the existing bundle identifier and Keychain identifiers when moving files so installed copies can read their data.
