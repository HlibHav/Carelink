export const toneOptions = [
  'warm_empathic',
  'calm_soothing',
  'supportive_caring',
  'coach_grounded',
  'reflective_thoughtful',
  'cheerful_light',
  'playful_energetic',
  'serious_direct',
] as const;

export type TonePresetName = (typeof toneOptions)[number];
