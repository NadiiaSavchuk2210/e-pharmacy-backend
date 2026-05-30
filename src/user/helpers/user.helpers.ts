export function getOptionalAvatar(source: {
  avatar?: unknown;
}): string | undefined {
  return typeof source.avatar === 'string' && source.avatar.trim()
    ? source.avatar
    : undefined;
}
