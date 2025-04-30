// src/store/theme.ts
import { useEffect } from 'react';
import { atom, useAtom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';

// Olası tema değerlerini tanımla
type Theme = 'light' | 'dark' | 'system';

// localStorage'a erişimi güvenli hale getirmek için bir yardımcı
const getLocalStorage = (): Storage | undefined => {
  try {
    // typeof kontrolü SSR/build sırasında hatayı önler
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch (e) {
    // localStorage erişilemezse (örn. özel modda veya devre dışıysa)
    console.error("localStorage is not available.", e);
  }
  return undefined;
}

// atomWithStorage için storage nesnesi oluştur
const storage = createJSONStorage<Theme | null>(() => getLocalStorage());

// Tema tercihini (light, dark, system) localStorage'da saklayan atom
// Başlangıç değeri 'system'
export const themePreferenceAtom = atomWithStorage<Theme>('app-theme', 'system', storage);

// Gerçekte uygulanacak temayı (light veya dark) hesaplayan atom
export const actualThemeAtom = atom<Exclude<Theme, 'system'>>((get) => {
  const preference = get(themePreferenceAtom);

  if (preference === 'system') {
    // Sadece client tarafında sistem tercihini kontrol et
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    // SSR veya window yoksa varsayılan olarak 'light' kullan
    return 'light';
  }
  // 'light' veya 'dark' tercihi doğrudan kullanılır
  return preference;
});

// Temayı yönetmek ve HTML elementine uygulamak için custom hook
export function useThemeManager() {
  const [preference, setPreference] = useAtom(themePreferenceAtom);
  const [actualTheme] = useAtom(actualThemeAtom);

  // actualTheme değiştiğinde HTML elementine 'dark' veya 'light' class'ını uygula
  useEffect(() => {
    const root = document.documentElement; // <html> elementi
    root.classList.remove('light', 'dark'); // Önceki class'ları temizle
    root.classList.add(actualTheme);       // Mevcut temayı ekle
    console.log(`Theme applied: ${actualTheme}`); // Konsola log yazdır (debug için)
  }, [actualTheme]);

  return {
    theme: actualTheme, // Geçerli tema ('light' | 'dark')
    themePreference: preference, // Kullanıcının tercihi ('light' | 'dark' | 'system')
    setThemePreference: setPreference, // Tercihi değiştiren fonksiyon
  };
}