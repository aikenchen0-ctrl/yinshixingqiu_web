export interface MonthSelection {
  monthKey: string
  selectedDateKey: string
  hasCoursesInMonth: boolean
}

export declare function shiftMonthKey(monthKey: string, delta: number): string
export declare function resolveMonthSelection(
  monthKey: string,
  dateMap: Record<string, unknown[]>
): MonthSelection
export declare function buildPickerValue(monthKey: string): string
