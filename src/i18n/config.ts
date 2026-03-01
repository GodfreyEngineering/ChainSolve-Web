import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import it from './locales/it.json'
import de from './locales/de.json'
import he from './locales/he.json'

import { getDirection } from './rtl'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Deutsch' },
  // P148: RTL support — Hebrew stub locale (translations pending; falls back to English).
  { code: 'he', label: 'עברית' },
] as const

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      es: { translation: es },
      fr: { translation: fr },
      it: { translation: it },
      de: { translation: de },
      he: { translation: he },
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'cs:lang',
    },
    // Synchronous init: with all resources pre-bundled (static JSON imports)
    // i18next resolves synchronously when initAsync is false.  React
    // therefore renders with the correct locale on the very first pass,
    // eliminating the English flash for non-English users.
    initAsync: false,
  })

// Keep <html lang> and <html dir> in sync when the user changes language.
// The pre-paint values are written by boot.ts; this listener handles
// subsequent changes without a page reload.
// P148: dir is set to 'rtl' for Hebrew, Arabic, and other RTL languages.
i18n.on('languageChanged', (lng: string) => {
  if (typeof document !== 'undefined') {
    const code = lng.slice(0, 2)
    document.documentElement.lang = code
    document.documentElement.dir = getDirection(code)
  }
})

export default i18n
