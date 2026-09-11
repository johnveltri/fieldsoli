/**
 * TS 6 does not resolve `expo-font` types through the package `exports` map.
 * Runtime imports are unchanged; this shim is for `tsc` only.
 */
declare module 'expo-font' {
  export function useFonts(map: Record<string, unknown>): [boolean, Error | null];
  export function loadAsync(
    fontFamilyOrFontMap: string | Record<string, unknown>,
    source?: unknown,
  ): Promise<void>;
  export function isLoaded(fontFamily: string): boolean;
}
