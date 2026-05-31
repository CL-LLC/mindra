export type AiLanguage = 'en' | 'es';

export function normalizeText(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\-•\d.\)\s]+/, '')
    .replace(/["'`]+/g, '')
    .trim();
}

export function detectLanguage(texts: string[]): AiLanguage {
  const sample = ` ${texts.join(' ').toLowerCase().replace(/\s+/g, ' ')} `;
  const spanishSignals = [
    ' el ', ' la ', ' los ', ' las ', ' tengo ', ' quiero ', ' estoy ', ' ser ',
    ' conmigo', ' éxito', ' confianza', ' trabajo', ' dinero ', ' salud ',
    ' familia ', ' mi ', ' mis ', ' para ', ' por ', ' con ', ' una ', ' uno ',
    ' lograr ', ' obtener ', ' alcanzar ', ' conseguir ', ' tener ', ' estar ',
    ' voy ', ' puedo ', ' haré ', ' mi meta ', ' mi objetivo ',
  ];
  const englishSignals = [
    ' the ', ' and ', ' to ', ' my ', ' is ', ' am ', ' want ', ' become ',
    ' confidence ', ' career ', ' health ', ' money ', ' family ', ' daily ',
    ' i want ', ' i will ', ' i can ', ' my goal ', ' my aim ', ' achieve ',
    ' accomplish ', ' get ', ' have ', ' be ', ' for ', ' with ', ' a ',
  ];
  const spanishScore = spanishSignals.reduce((sum, s) => sum + (sample.includes(s) ? 1 : 0), 0);
  const englishScore = englishSignals.reduce((sum, s) => sum + (sample.includes(s) ? 1 : 0), 0);
  return spanishScore > englishScore ? 'es' : 'en';
}

export function resolvePreferredGenerationLanguage(args: {
  preferredLanguage?: AiLanguage | null;
  detectedLanguage: AiLanguage;
}): AiLanguage {
  return args.preferredLanguage ?? args.detectedLanguage;
}

export function languageInstruction(language: AiLanguage | string) {
  return language === 'es'
    ? 'Write every affirmation in natural Spanish. Never translate to English.'
    : 'Write every affirmation in natural English. Never translate to Spanish.';
}

export function draftLanguageInstruction(language: AiLanguage | string) {
  return language === 'es'
    ? 'Escribe el título y los objetivos en español natural. No cambies al inglés aunque la entrada contenga palabras en inglés.'
    : 'Write the title and goals in natural English. Do not switch to Spanish even if the input contains Spanish words.';
}

export function draftLanguageRules(language: AiLanguage) {
  return language === 'es'
    ? 'CRITICAL: The title and goals MUST be in Spanish because the user selected Spanish as the app language. Do not output English unless the user-provided text is a proper noun or brand name.'
    : 'CRITICAL: The title and goals MUST be in English because the user selected English as the app language. Do not output Spanish unless the user-provided text is a proper noun or brand name.';
}
