import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from './locales/en.json'
import es from './locales/es.json'
import fr from './locales/fr.json'
import it from './locales/it.json'
import de from './locales/de.json'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Deutsch' },
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
    },
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'cs:lang',
    },
    // Synchronous init: with all resources pre-bundled (static JSON imports)
    // i18next resolves synchronously when initImmediate is false.  React
    // therefore renders with the correct locale on the very first pass,
    // eliminating the English flash for non-English users.
    initImmediate: false,
  })

// Keep <html lang> in sync when the user changes language in Settings.
// The pre-paint value is written by boot.ts; this listener handles
// subsequent changes without a page reload.
i18n.on('languageChanged', (lng: string) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng.slice(0, 2)
  }
})

export default i18n
