/**
 * windowIds.ts — Window identifier constants for lazy-loaded components.
 *
 * These are kept separate from the component files so that importing a
 * window ID does not force a static import of the (lazy) component,
 * which would defeat code-splitting and trigger Vite "dynamic + static"
 * import warnings.
 */

export const ABOUT_WINDOW_ID = 'about'
export const DOCS_WINDOW_ID = 'docs'
export const THEME_WIZARD_WINDOW_ID = 'theme-wizard'
export const THEME_LIBRARY_WINDOW_ID = 'theme-library'
