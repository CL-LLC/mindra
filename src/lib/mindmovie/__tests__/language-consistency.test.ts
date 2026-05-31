#!/usr/bin/env npx tsx

import assert from 'assert';
import { resolveCreationLanguage } from '../language';
import { resolvePreferredGenerationLanguage, draftLanguageInstruction } from '../../../../convex/aiLanguage';

function testUiLanguageLocksCreateFlowWhenUserPreferenceIsStillLoading() {
  const language = resolveCreationLanguage({
    userPreferredLanguage: null,
    uiLanguage: 'en',
    draftLanguage: 'es',
    texts: ['Quiero confianza y éxito'],
  });

  assert.strictEqual(
    language,
    'en',
    'selected UI language should beat AI draft/detection when saved user preference is not loaded yet'
  );
}

function testSavedUserPreferenceIsAuthoritative() {
  assert.strictEqual(
    resolveCreationLanguage({
      userPreferredLanguage: 'en',
      uiLanguage: 'es',
      draftLanguage: 'es',
      texts: ['Quiero confianza'],
    }),
    'en',
    'saved English preference should not be overridden by Spanish draft content'
  );

  assert.strictEqual(
    resolveCreationLanguage({
      userPreferredLanguage: 'es',
      uiLanguage: 'en',
      draftLanguage: 'en',
      texts: ['I want confidence'],
    }),
    'es',
    'saved Spanish preference should not be overridden by English draft content'
  );
}

function testServerDraftLanguagePrefersExplicitSelectionOverDetection() {
  assert.strictEqual(
    resolvePreferredGenerationLanguage({ preferredLanguage: 'en', detectedLanguage: 'es' }),
    'en',
    'server draft generation should respect explicit English selection even when detection sees Spanish signals'
  );

  assert.strictEqual(
    resolvePreferredGenerationLanguage({ preferredLanguage: 'es', detectedLanguage: 'en' }),
    'es',
    'server draft generation should respect explicit Spanish selection even when detection sees English signals'
  );
}

function testDraftPromptInstructionLocksSelectedLanguageNotInputLanguage() {
  const englishInstruction = draftLanguageInstruction('en');
  assert.match(englishInstruction, /English/i);
  assert.doesNotMatch(
    englishInstruction,
    /same language as the user input/i,
    'English-selected users should not be told to follow Spanish input/detection'
  );

  const spanishInstruction = draftLanguageInstruction('es');
  assert.match(spanishInstruction, /español|Spanish/i);
  assert.doesNotMatch(
    spanishInstruction,
    /mismo idioma que la entrada|same language as the user input/i,
    'Spanish-selected users should be locked to Spanish, not ambiguous input language'
  );
}

testUiLanguageLocksCreateFlowWhenUserPreferenceIsStillLoading();
testSavedUserPreferenceIsAuthoritative();
testServerDraftLanguagePrefersExplicitSelectionOverDetection();
testDraftPromptInstructionLocksSelectedLanguageNotInputLanguage();

console.log('language-consistency tests passed');
