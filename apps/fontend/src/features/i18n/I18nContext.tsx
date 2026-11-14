import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { en } from './locales/en';
import { vi } from './locales/vi';

export type LanguageCode = 'vi' | 'en';

const LANG_STORAGE_KEY = 'cloud_stock_lang';

const dictionaries = { vi, en } as const;

type DotPrefix<T extends string, P extends string> = `${P}.${T}`;
type NestedKeyOf<Obj> = Obj extends string
  ? never
  : {
      [K in keyof Obj & string]: Obj[K] extends string
        ? K
        : DotPrefix<NestedKeyOf<Obj[K]>, K>;
    }[keyof Obj & string];

export type TranslationKey = NestedKeyOf<typeof en>;

interface I18nContextType {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  toggleLang: () => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function getInitialLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored === 'vi' || stored === 'en') {
      return stored;
    }
  } catch {
    // Ignore storage read failure
  }
  return 'vi';
}

function resolveKey(dict: typeof en | typeof vi, key: string): string {
  const parts = key.split('.');
  let current: unknown = dict;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return key;
    }
  }
  return typeof current === 'string' ? current : key;
}

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<LanguageCode>(getInitialLanguage);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang);
    } catch {
      // Ignore storage write failure
    }
  }, [lang]);

  const setLang = useCallback((next: LanguageCode) => {
    setLangState(next);
  }, []);

  const toggleLang = useCallback(() => {
    setLangState((prev) => (prev === 'vi' ? 'en' : 'vi'));
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      let text = resolveKey(dictionaries[lang], key);
      if (text === key && lang !== 'en') {
        text = resolveKey(dictionaries.en, key);
      }
      if (params) {
        for (const [paramKey, paramVal] of Object.entries(params)) {
          text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
        }
      }
      return text;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}

