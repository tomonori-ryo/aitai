export type TeaseContext = {
  /** 質問表示から回答までの経過ms */
  elapsedMs: number
  /** NOボタンに触れた／カーソルが乗ったか */
  touchedNo: boolean
}

export type YesTease = {
  /** 結果画面のメイン見出し（からかいセリフ） */
  headline: string
  /** 「やっぱりNOにする？」を出すか */
  showFakeNo: boolean
  /** 今更NOを押したときのツッコミ */
  fakeNoReply: string
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

/** 1. 主役セリフ型 */
const HERO_LINES = [
  'え、会いたいんじゃん（笑）',
  'ほら、やっぱり会いたいんだ',
  '素直か',
  '会いたいって言っちゃったね',
  'YES押しちゃったね、自覚ある？',
] as const

/** 2. 回答スピード型・即答 */
const FAST_LINES = [
  '秒で押したね…素直か',
  '即答じゃん、隠しきれてないよ',
  'ためらいゼロだったね（笑）',
  '速さで気持ちバレてる',
] as const

/** 2. 迷った末 */
const SLOW_LINES = [
  '散々迷った末のYESってことは、相当会いたいんじゃん（笑）',
  '悩んだ分だけ本気っぽいね',
  '時間かけたのに結局YESかよ',
  '迷って迷って、でYES。わかったよ',
] as const

/** 2. 中間（軽め／ほぼなし） */
const MID_LINES = [
  'YES！',
  'うん、YESだね',
  'まぁ普通のテンポだね',
  '会いたいんだ、了解',
] as const

/** 3. NO接触検知型 */
const NO_TOUCH_LINES = [
  'あ、今NOの方に一瞬触れたでしょ？笑 でも結局YESなんじゃん',
  'NO押しかけてたの見えてたよ？で、YESね',
  'NO迷ったくせに、最後は素直じゃん',
  'NO狙いだったの？残念、YES確定で',
  '迷ってNO触ったのに、結局会いたい側か',
] as const

/** 4. 今更NOへのツッコミ */
const FAKE_NO_REPLIES = [
  '今更遅いよ、もう会いたいって伝わってるし（笑）',
  '記録はもうYESだよ？撤回とかないからね',
  'うそつけ、会いたいって顔してたじゃん',
  'NOにしても気持ちは消せないよ？',
  'あざとい。もう遅いからね',
] as const

/**
 * YES結果用のからかい演出を組み立てる。
 * パターン1〜3から条件付きで1つ、パターン4は独立抽選。
 */
export function buildYesTease(ctx: TeaseContext): YesTease {
  type Pattern = 'hero' | 'speed' | 'noTouch'
  const pool: Pattern[] = ['hero', 'speed']
  if (ctx.touchedNo) pool.push('noTouch')

  const pattern = pick(pool)
  let headline: string

  if (pattern === 'hero') {
    headline = pick(HERO_LINES)
  } else if (pattern === 'noTouch') {
    headline = pick(NO_TOUCH_LINES)
  } else if (ctx.elapsedMs < 2000) {
    headline = pick(FAST_LINES)
  } else if (ctx.elapsedMs >= 10000) {
    headline = pick(SLOW_LINES)
  } else {
    headline = pick(MID_LINES)
  }

  return {
    headline,
    showFakeNo: Math.random() < 0.45,
    fakeNoReply: pick(FAKE_NO_REPLIES),
  }
}
