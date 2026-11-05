jest.mock('expo-application', () => ({ nativeApplicationVersion: '1.2.3', nativeBuildVersion: '87' }));
import { analyticsConfig, ANALYTICS_SCHEMA_VERSION } from './config';
it('uses the installed native binary metadata and schema 2', () => {
  expect(analyticsConfig.appVersion).toBe('1.2.3');
  expect(analyticsConfig.buildNumber).toBe('87');
  expect(ANALYTICS_SCHEMA_VERSION).toBe(2);
});
