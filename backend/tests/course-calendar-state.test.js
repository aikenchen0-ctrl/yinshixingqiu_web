const test = require('node:test')
const assert = require('node:assert/strict')

const {
  shiftMonthKey,
  resolveMonthSelection,
  buildPickerValue,
} = require('../../miniprogram/pages/course/calendar-state.js')

test('shiftMonthKey moves across natural months including year boundaries', () => {
  assert.equal(shiftMonthKey('2026-04', -1), '2026-03')
  assert.equal(shiftMonthKey('2026-04', 1), '2026-05')
  assert.equal(shiftMonthKey('2026-01', -1), '2025-12')
  assert.equal(shiftMonthKey('2026-12', 1), '2027-01')
})

test('resolveMonthSelection chooses first course day in target month', () => {
  const selection = resolveMonthSelection('2026-04', {
    '2026-04-18': [{ id: 'c1' }],
    '2026-04-06': [{ id: 'c2' }],
    '2026-05-03': [{ id: 'c3' }],
  })

  assert.deepEqual(selection, {
    monthKey: '2026-04',
    selectedDateKey: '2026-04-06',
    hasCoursesInMonth: true,
  })
})

test('resolveMonthSelection falls back to first day for empty month', () => {
  const selection = resolveMonthSelection('2026-03', {
    '2026-04-06': [{ id: 'c2' }],
    '2026-05-03': [{ id: 'c3' }],
  })

  assert.deepEqual(selection, {
    monthKey: '2026-03',
    selectedDateKey: '2026-03-01',
    hasCoursesInMonth: false,
  })
})

test('buildPickerValue mirrors month keys for month picker', () => {
  assert.equal(buildPickerValue('2026-04'), '2026-04')
})
