import type { TonePresetName } from '../services/elevenLabsService.js';

import type { EmotionState, ModePlan } from './types.js';


export function determineTone(emotion: EmotionState, plan: ModePlan): TonePresetName {
  if (plan.mode === 'support') {
    if (emotion.primary === 'sadness' || emotion.intensity === 'high') {
      return 'warm_empathic';
    }
    return 'supportive_caring';
  }

  if (plan.mode === 'coach') {
    if (plan.goal === 'suggest_tiny_step') {
      return 'coach_grounded';
    }
    return 'supportive_caring';
  }

  if (plan.mode === 'gratitude') {
    return 'cheerful_light';
  }

  if (plan.mode === 'game') {
    return 'playful_energetic';
  }

  if (plan.mode === 'reminder') {
    return 'serious_direct';
  }

  return 'calm_soothing';
}
