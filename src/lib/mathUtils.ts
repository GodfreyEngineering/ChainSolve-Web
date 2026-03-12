/** True if text contains LaTeX math delimiters ($...$ or $$...$$). */
export const hasMath = (text: string): boolean => /\$/.test(text)
