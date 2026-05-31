export type MindraLanguage = 'en' | 'es';

const SPANISH_SIGNALS = [
  ' el ', ' la ', ' los ', ' las ', ' tengo ', ' quiero ', ' estoy ', ' ser ',
  ' conmigo', ' éxito', ' confianza', ' trabajo', ' dinero', ' salud', ' familia',
  ' mi ', ' mis ', ' para ', ' por ', ' con ', ' una ', ' uno ', ' lograr ',
  ' obtener ', ' alcanzar ', ' conseguir ', ' tener ', ' estar ', ' voy ', ' puedo ',
  ' haré ', ' mi meta ', ' mi objetivo ',
];

const ENGLISH_SIGNALS = [
  ' the ', ' and ', ' to ', ' my ', ' is ', ' am ', ' want ', ' become ',
  ' confidence', ' career', ' health', ' money', ' family', ' daily ', ' i want ',
  ' i will ', ' i can ', ' my goal ', ' my aim ', ' achieve ', ' accomplish ',
  ' get ', ' have ', ' be ', ' for ', ' with ', ' a ',
];

export function detectLanguage(texts: string[]): MindraLanguage {
  const sample = ` ${texts.join(' ').toLowerCase().replace(/\s+/g, ' ')} `;
  const spanishScore = SPANISH_SIGNALS.reduce((sum, signal) => sum + (sample.includes(signal) ? 1 : 0), 0);
  const englishScore = ENGLISH_SIGNALS.reduce((sum, signal) => sum + (sample.includes(signal) ? 1 : 0), 0);
  return spanishScore > englishScore ? 'es' : 'en';
}

export function normalizeLanguage(value: unknown): MindraLanguage | null {
  return value === 'en' || value === 'es' ? value : null;
}

type ResolveCreationLanguageArgs = {
  userPreferredLanguage?: MindraLanguage | null;
  uiLanguage?: MindraLanguage | null;
  draftLanguage?: MindraLanguage | null;
  texts: string[];
};

/**
 * Resolves the language for all generated and persisted user-facing content.
 *
 * The saved user preference and currently selected UI language are explicit user
 * choices, so they must beat AI draft language and heuristic content detection.
 */
export function resolveCreationLanguage({
  userPreferredLanguage,
  uiLanguage,
  draftLanguage,
  texts,
}: ResolveCreationLanguageArgs): MindraLanguage {
  return (
    normalizeLanguage(userPreferredLanguage) ??
    normalizeLanguage(uiLanguage) ??
    normalizeLanguage(draftLanguage) ??
    detectLanguage(texts)
  );
}
