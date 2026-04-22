export function resolveLegacyAdminEntryPath(groupId?: string) {
  return groupId ? `/group/${encodeURIComponent(groupId)}` : '/group_data'
}
