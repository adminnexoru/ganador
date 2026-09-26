// Tipos de contracts/app-api.md y contracts/public-api.md.

export type User = {
  id: string;
  phone: string;
  displayName: string;
  whatsappAlertsEnabled: boolean;
  whatsappConfirmed: boolean;
  locale: string;
};

export type Tokens = { accessToken: string; refreshToken: string };

export type VerifyResponse = Tokens & { user: User; needsConsent: boolean };

export type Activity = 'moving' | 'resting' | 'no_signal';

export type Location = {
  position: { lat: number; lng: number; accuracyM: number | null; recordedAt: string } | null;
  battery: { levelPct: number; recordedAt: string } | null;
  activity: Activity | null;
  activitySince: string | null;
  stale: boolean;
};

export type Species = 'dog' | 'cat';
export type PetSize = 'small' | 'medium' | 'large';
export type PetRole = 'owner' | 'family';

export type Pet = {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  size: PetSize | null;
  conditions: string | null;
  medications: string | null;
  photoUrl: string | null;
  role: PetRole;
  location?: Location | null;
};

export type PetInput = {
  name: string;
  species: Species;
  breed?: string | null;
  size?: PetSize | null;
  conditions?: string | null;
  medications?: string | null;
};

export type Zone = {
  id: string;
  name: string;
  centerLat: number;
  centerLng: number;
  radiusM: number;
  active: boolean;
};

export type TrackPoint = { lat: number; lng: number; recordedAt: string };

export type Access = {
  id: string;
  role: PetRole;
  status: 'invited' | 'active' | 'revoked';
  phone: string | null;
  displayName: string | null;
};

export type Invitation = { id: string; petName: string; invitedBy: string };

export type Tag = { id: string; code: string; status: 'inactive' | 'active' | 'disabled' };

export type PublicProfileSettings = {
  showOwnerName: boolean;
  showConditions: boolean;
  showMedications: boolean;
};

export type PublicTag =
  | { status: 'inactive' }
  | {
      status: 'active';
      pet: { name: string; species: Species; photoUrl: string | null };
      owner: { name?: string; whatsappUrl: string };
      health?: { conditions?: string; medications?: string };
    };
