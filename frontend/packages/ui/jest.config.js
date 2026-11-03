module.exports = {
  preset: 'jest-expo',
  // lucide ships ESM for bundlers; Jest uses the CommonJS build.
  moduleNameMapper: { '^lucide-react-native$': require.resolve('lucide-react-native') /* Node resolves the CommonJS build */ },
  roots: ['<rootDir>/test'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-.*|react-native-.*|nativewind|react-native-css-interop)/)',
  ],
};
