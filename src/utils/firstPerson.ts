/** 質問文の一人称部分（「◯◯に会いたい？」） */
export const FIRST_PERSON_PRESETS = ['俺', '私', '僕', 'あたし', 'わたし', 'うち'] as const

export const DEFAULT_FIRST_PERSON = '俺'

export function sanitizeFirstPerson(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_FIRST_PERSON
  const trimmed = value.trim().slice(0, 10)
  if (!trimmed) return DEFAULT_FIRST_PERSON
  // 改行・制御文字を除外
  return trimmed.replace(/[\r\n\t]/g, '')
}

export function questionTitle(firstPerson: string = DEFAULT_FIRST_PERSON): string {
  return `${sanitizeFirstPerson(firstPerson)}に会いたい？`
}
