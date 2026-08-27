// Single source of truth for occasion vocabulary. Used by:
//   - the /outfit page <select> (label + emoji shown in dropdown)
//   - the rules engine (formality hint that nudges item selection)
export const OCCASIONS = [
  { value: 'casual',      label: 'Casual',       emoji: '☕',  targetFormality: 'casual'        as const },
  { value: 'school',      label: 'School',       emoji: '📚',  targetFormality: 'casual'        as const },
  { value: 'date_night',  label: 'Date Night',   emoji: '🌙',  targetFormality: 'smart_casual'  as const },
  { value: 'interview',   label: 'Interview',    emoji: '💼',  targetFormality: 'formal'        as const },
  { value: 'formal',      label: 'Formal Event', emoji: '🥂',  targetFormality: 'formal'        as const },
] as const

export type OccasionValue = (typeof OCCASIONS)[number]['value']
export type Formality     = (typeof OCCASIONS)[number]['targetFormality']

const BY_VALUE = Object.fromEntries(
  OCCASIONS.map(o => [o.value, o])
) as Record<OccasionValue, (typeof OCCASIONS)[number]>

// Returns the formality a good outfit for this occasion should target.
// Falls back to 'casual' so a stray occasion value never throws.
export function getOccasionTarget(occasion: string): Formality {
  return BY_VALUE[occasion as OccasionValue]?.targetFormality ?? 'casual'
}
