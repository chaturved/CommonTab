module.exports = {
  preset: 'jest-expo',
  moduleNameMapper: { '^lucide-react-native$': require.resolve('lucide-react-native') },
  roots: ['<rootDir>/test'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-.*|react-native-.*|nativewind|react-native-css-interop)/)',
  ],
};
