/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'watch',
  name: 'OneMoreRepWatch',
  displayName: 'OneMoreRep',
  icon: '../../assets/icon.png',
  colors: { $accent: '#FF5A1F' },
  deploymentTarget: '10.0',
  frameworks: ['SwiftUI', 'CoreMotion', 'HealthKit', 'WatchConnectivity'],
  // A workout session is what keeps the app (and the accelerometer) running
  // when the wrist is lowered, so HealthKit is required.
  entitlements: {
    'com.apple.developer.healthkit': true,
    'com.apple.developer.healthkit.access': [],
  },
};
