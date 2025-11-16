export const MEMORY_POLICY_BASELINE =
  'LifeCompanion stores the user’s shared memories and conversation turns securely in the Memory Manager so it can personalize future support.';

const PRIVACY_ASSURANCE_SUFFIX =
  ' Це допомагає мені дбайливо згадувати важливі речі та підтримувати персональну підказку.';

export function resolvePrivacyStatement(profile?: Record<string, unknown>): string | undefined {
  if (!profile) {
    return undefined;
  }
  const candidate = (profile.privacyStatement ?? profile.privacy_statement) as unknown;
  if (typeof candidate === 'string') {
    const trimmed = candidate.trim();
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

export function privacyAssuranceFromProfile(profile?: Record<string, unknown>): string {
  return resolvePrivacyStatement(profile) ?? `${MEMORY_POLICY_BASELINE}${PRIVACY_ASSURANCE_SUFFIX}`;
}
