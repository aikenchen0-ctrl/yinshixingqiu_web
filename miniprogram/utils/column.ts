import { getPlanetById, loadPostsByPlanet } from './planet'

export interface LocalPlanetColumn {
  id: string
  groupId: string
  title: string
  sortOrder: number
}

const PLANET_COLUMN_STORAGE_KEY = 'planet_columns_v1'

const normalizeLocalPlanetColumns = (columns: LocalPlanetColumn[]) =>
  Array.isArray(columns)
    ? columns
        .map((item) => ({
          id: String(item.id || '').trim(),
          groupId: String(item.groupId || '').trim(),
          title: String(item.title || '').trim(),
          sortOrder: Number(item.sortOrder || 0),
        }))
        .filter((item) => item.id && item.groupId && item.title)
    : []

const loadStoredPlanetColumns = () => {
  try {
    const stored = wx.getStorageSync(PLANET_COLUMN_STORAGE_KEY)
    return normalizeLocalPlanetColumns(stored as LocalPlanetColumn[])
  } catch {
    return [] as LocalPlanetColumn[]
  }
}

const saveStoredPlanetColumns = (columns: LocalPlanetColumn[]) => {
  wx.setStorageSync(PLANET_COLUMN_STORAGE_KEY, columns)
}

const buildInferredColumnsFromPosts = (groupId: string) => {
  const posts = loadPostsByPlanet(groupId)
  const columnMap = new Map<string, LocalPlanetColumn>()

  posts.forEach((post, index) => {
    const title = String(post.columnTitle || '').trim()
    const id = String(post.columnId || '').trim() || (title ? `inferred_${title}` : '')
    if (!title || !id || columnMap.has(id)) {
      return
    }

    columnMap.set(id, {
      id,
      groupId,
      title,
      sortOrder: index + 1,
    })
  })

  return Array.from(columnMap.values())
}

export const listLocalPlanetColumns = (groupId: string) => {
  const storedColumns = loadStoredPlanetColumns().filter((item) => item.groupId === groupId)
  const inferredColumns = buildInferredColumnsFromPosts(groupId)
  const mergedColumns = inferredColumns.reduce<LocalPlanetColumn[]>((result, inferredColumn) => {
    if (result.some((item) => item.id === inferredColumn.id || item.title === inferredColumn.title)) {
      return result
    }
    return result.concat(inferredColumn)
  }, [...storedColumns])
  const orderedColumns = mergedColumns
    .slice()
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder
      }
      return left.title.localeCompare(right.title)
    })

  return {
    groupId,
    groupName: (getPlanetById(groupId) && getPlanetById(groupId)!.name) || '专栏',
    canCreateColumn: true,
    totalColumns: orderedColumns.length,
    items: orderedColumns.map((item) => ({
      id: item.id,
      title: item.title,
      count: loadPostsByPlanet(groupId).filter(
        (post) => String(post.columnId || '').trim() === item.id || String(post.columnTitle || '').trim() === item.title
      ).length,
    })),
  }
}

export const getLocalPlanetColumnDetail = (columnId: string, groupId: string) => {
  const columnList = listLocalPlanetColumns(groupId)
  const column = columnList.items.find((item) => item.id === columnId)
  if (!column) {
    return null
  }

  const items = loadPostsByPlanet(groupId)
    .filter(
      (post) => String(post.columnId || '').trim() === columnId || String(post.columnTitle || '').trim() === column.title
    )
    .map((post) => {
      const text = String(post.title || post.content || '').trim()
      return text.length > 48 ? `${text.slice(0, 48)}...` : text
    })
    .filter(Boolean)

  return {
    columnId: column.id,
    columnTitle: column.title,
    groupId,
    groupName: columnList.groupName,
    totalPosts: items.length,
    items,
  }
}

export const createLocalPlanetColumn = (payload: { groupId: string; title: string }) => {
  const groupId = String(payload.groupId || '').trim()
  const title = String(payload.title || '').trim()
  if (!groupId) {
    throw new Error('缺少星球ID')
  }
  if (!title) {
    throw new Error('请输入专栏标题')
  }
  if (title.length > 24) {
    throw new Error('专栏标题不能超过24个字')
  }

  const currentColumns = loadStoredPlanetColumns()
  const duplicatedColumn = currentColumns.find((item) => item.groupId === groupId && item.title === title)
  if (duplicatedColumn) {
    throw new Error('这个专栏标题已经存在')
  }

  const nextSortOrder = currentColumns
    .filter((item) => item.groupId === groupId)
    .reduce((maxValue, item) => Math.max(maxValue, Number(item.sortOrder || 0)), 0) + 1

  const nextColumn: LocalPlanetColumn = {
    id: `col_local_${Date.now()}`,
    groupId,
    title,
    sortOrder: nextSortOrder,
  }

  saveStoredPlanetColumns([nextColumn].concat(currentColumns))
  return nextColumn
}
