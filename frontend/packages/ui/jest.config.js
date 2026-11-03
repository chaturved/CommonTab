module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/test'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-.*|react-native-.*|nativewind|react-native-css-interop)/)',
  ],
};
