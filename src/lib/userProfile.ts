import { getItem, setItem } from './storage';

const PROFILE_KEY = 'signdocu-user-profile';

export interface UserProfile {
  displayName: string;
  preferredFont: 'cursive' | 'serif' | 'sans-serif' | 'monospace';
  preferredSigColor: string;
  preferredPosition: {
    /** X offset from right edge (negative = from right) */
    x: number;
    /** Y offset from top */
    y: number;
    width: number;
    height: number;
  };
  quickSignEnabled: boolean;
  lastUsedSigId?: string;
}

const DEFAULT_PROFILE: UserProfile = {
  displayName: '',
  preferredFont: 'cursive',
  preferredSigColor: '#1a1a1a',
  preferredPosition: {
    x: -200,  // 200px from right edge
    y: 40,    // 40px from top
    width: 200,
    height: 60,
  },
  quickSignEnabled: false,
};

export async function getProfile(): Promise<UserProfile> {
  try {
    const stored = await getItem<UserProfile>(PROFILE_KEY);
    if (stored && typeof stored.displayName === 'string') {
      return { ...DEFAULT_PROFILE, ...stored };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_PROFILE };
}

export async function saveProfile(profile: Partial<UserProfile>): Promise<UserProfile> {
  const current = await getProfile();
  const updated = { ...current, ...profile };
  await setItem(PROFILE_KEY, updated);
  return updated;
}

export async function isQuickSignAvailable(): Promise<boolean> {
  const profile = await getProfile();
  return profile.quickSignEnabled && profile.displayName.length > 0;
}

export async function isQuickSignEnabled(): Promise<boolean> {
  const profile = await getProfile();
  return profile.quickSignEnabled;
}
