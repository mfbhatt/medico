/**
 * Drop-in replacement for expo-secure-store using AsyncStorage.
 * Expo Go does not bundle the correct SecureStore native module,
 * causing "setValueWithKeyAsync / getValueWithKeyAsync is not a function".
 * AsyncStorage works everywhere without a native rebuild.
 *
 * NOTE: AsyncStorage is unencrypted. For a production build (standalone app),
 * swap this back to expo-secure-store once native modules are properly linked.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  getItemAsync: (key: string): Promise<string | null> =>
    AsyncStorage.getItem(key),

  setItemAsync: (key: string, value: string): Promise<void> =>
    AsyncStorage.setItem(key, value),

  deleteItemAsync: (key: string): Promise<void> =>
    AsyncStorage.removeItem(key),
};
