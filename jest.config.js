module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  globals: {
    TESTING: true,
    SYMBOLS_S3_BUCKET: "gitlab-test-symbols",
  },
  maxConcurrency: 5,
};