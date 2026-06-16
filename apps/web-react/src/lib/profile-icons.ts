import type { KerodexUser } from './api';

export const DEFAULT_PROFILE_ICONS = Array.from({ length: 10 }, (_, index) => `/pfpicon${index}.png`);

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function defaultProfileIconForUser(user?: Pick<KerodexUser, 'id' | 'email' | 'username'> | null) {
  const seed = String(user?.id || user?.email || user?.username || 'kerodex-user');
  return DEFAULT_PROFILE_ICONS[stableHash(seed) % DEFAULT_PROFILE_ICONS.length];
}
