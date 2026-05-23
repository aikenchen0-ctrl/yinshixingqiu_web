const toTwoDigits = (value) => (value < 10 ? `0${value}` : String(value))

const parseMonthKey = (monthKey) => {
  const matched = /^(\d{4})-(\d{2})$/.exec(String(monthKey || '').trim())
  if (!matched) {
    return null
  }

  return {
    year: Number(matched[1]),
    month: Number(matched[2]),
  }
}

const shiftMonthKey = (monthKey, delta) => {
  const parsed = parseMonthKey(monthKey)
  if (!parsed || !Number.isFinite(delta)) {
    return ''
  }

  const date = new Date(parsed.year, parsed.month - 1 + delta, 1)
  return `${date.getFullYear()}-${toTwoDigits(date.getMonth() + 1)}`
}

const resolveMonthSelection = (monthKey, dateMap) => {
  const matchedDateKeys = Object.keys(dateMap || {})
    .filter((dateKey) => dateKey.slice(0, 7) === monthKey)
    .sort()

  return {
    monthKey,
    selectedDateKey: matchedDateKeys[0] || `${monthKey}-01`,
    hasCoursesInMonth: matchedDateKeys.length > 0,
  }
}

const buildPickerValue = (monthKey) => {
  const parsed = parseMonthKey(monthKey)
  return parsed ? `${parsed.year}-${toTwoDigits(parsed.month)}` : ''
}

module.exports = {
  shiftMonthKey,
  resolveMonthSelection,
  buildPickerValue,
}
