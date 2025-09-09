export function loginFromNoReply(email?: string) {
  if (!email) return undefined;
  // Matches "username@users.noreply.github.com" and "12345+username@users.noreply.github.com"
  const m = email
    .toLowerCase()
    .match(/^(?:\d+\+)?([a-z0-9-]+)@users\.noreply\.github\.com$/i);
  return m?.[1];
}
