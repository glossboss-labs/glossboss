export type UserRole = 'individual' | 'team_lead' | 'agency' | 'developer';

export type AttributionSource = 'search' | 'social' | 'word_of_mouth' | 'blog' | 'github' | 'other';

export interface OnboardingStatus {
  onboardingCompletedAt: string | null;
  role: UserRole | null;
  fullName: string | null;
}
