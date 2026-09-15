/** NO押下ごとの懇願段階（最終確定は FINAL_NO_STAGE） */

export const FINAL_NO_STAGE = 7

export type SoftAction = 'pause' | 'yes'

export type NoPleadContent = {
  stage: number
  line: string
  noLabel: string
  softLabel: string
  softAction: SoftAction
  /** 段階入場時のカウントダウン秒（ある場合のみ） */
  countdownSec?: number
  /** 見た目演出フラグ */
  shrinkNo?: boolean
  dogeza?: boolean
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

const STAGE_1_LINES = [
  'え、待って！？',
  'えっ、いまの本気…？',
  'ちょっと待って、聞き間違いかも',
  'え、NOって言った？いま？',
] as const

const STAGE_2_LINES = [
  'お願い、そんなこと言わないで…🥺',
  'ちょっと傷ついたかも…お願い',
  'そんなこと言わないでよ…お願いだから',
  'お願い、もう一回だけ考えて…🥺',
] as const

const STAGE_3_LINES = [
  '5秒だけ…5秒だけ考え直して…',
  'ほんの数秒でいいから、待って…',
  '深呼吸して。5秒だけでいいから',
  '焦らないで。ちょっとだけ時間ちょうだい',
] as const

const STAGE_4_LINES = [
  '見えてる？YESの方が…ちょうどいい大きさだよ？',
  'NO、ちょっと小さくない？気のせい？',
  'YESの方が押しやすそうに見えるね（偶然）',
  'ボタンの大きさ、気持ちを表してるかも…',
] as const

const STAGE_5_LINES = [
  '🙇 お願いします…お願いします…',
  '🙇‍♂️ 土下座するから…お願い…',
  'お願いしますお願いしますお願いします…🙇',
  'ここまで来てNOは…お願いします…🙇',
] as const

const STAGE_6_LINES = [
  '最後のお願い…本当に、これでいいの？',
  'もう引き止めないけど…本当にNO？',
  'これ以上は言わない。でも念押し、いい？',
  'わかってる。でも最後に一回だけ聞くね',
] as const

const ACCEPT_LINES = [
  '…わかった。NOだね。',
  '…了解。NOで確定するね。',
  'わかったよ。NOを受け入れる。',
  '…そうか。NOだね。ありがとう。',
] as const

export function pickAcceptLine(): string {
  return pick(ACCEPT_LINES)
}

/**
 * 段階番号（1〜FINAL_NO_STAGE-1）の演出内容を返す。
 * FINAL_NO_STAGE 以上は確定フェーズ（呼び出し側で扱う）。
 */
export function buildNoPlead(stage: number): NoPleadContent | null {
  if (stage < 1 || stage >= FINAL_NO_STAGE) return null

  if (stage === 1) {
    return {
      stage,
      line: pick(STAGE_1_LINES),
      noLabel: 'やっぱりNO',
      softLabel: 'ちょっと待って',
      softAction: 'pause',
    }
  }

  if (stage === 2) {
    return {
      stage,
      line: pick(STAGE_2_LINES),
      noLabel: '本当にNO',
      softLabel: '気が変わった',
      softAction: 'yes',
    }
  }

  if (stage === 3) {
    return {
      stage,
      line: pick(STAGE_3_LINES),
      noLabel: '考え直したけどNO',
      softLabel: 'YESにする',
      softAction: 'yes',
      countdownSec: 4,
    }
  }

  if (stage === 4) {
    return {
      stage,
      line: pick(STAGE_4_LINES),
      noLabel: '小さくてもNO',
      softLabel: 'やっぱりYES',
      softAction: 'yes',
      shrinkNo: true,
    }
  }

  if (stage === 5) {
    return {
      stage,
      line: pick(STAGE_5_LINES),
      noLabel: 'それでもNO',
      softLabel: 'YESで許す',
      softAction: 'yes',
      shrinkNo: true,
      dogeza: true,
    }
  }

  // stage 6（最終手前）
  return {
    stage,
    line: pick(STAGE_6_LINES),
    noLabel: '最終確認：NO',
    softLabel: 'YESに戻る',
    softAction: 'yes',
    shrinkNo: true,
    dogeza: true,
  }
}

/** YESボタンの見た目スケール（段階に応じて大きく） */
export function yesVisualScale(stage: number): number {
  if (stage < 4) return 1
  return Math.min(2.4, 1 + (stage - 3) * 0.35)
}

/** NOボタンの見た目スケール（段階に応じて小さく。選べなくはしない） */
export function noVisualScale(stage: number): number {
  if (stage < 4) return 1
  return Math.max(0.55, 1 - (stage - 3) * 0.12)
}
