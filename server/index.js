import { Resvg } from '@resvg/resvg-js'
import cors from 'cors'
import express from 'express'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '..', 'data')
const questionsDir = path.join(dataDir, 'questions')
const legacyFile = path.join(dataDir, 'questions.json')
const PORT = process.env.PORT || 3001
/** 簡易TTL: 30日以上触っていない質問を掃除 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
if (!fs.existsSync(questionsDir)) fs.mkdirSync(questionsDir, { recursive: true })

/** questionId ごとの更新キュー（同時書き込みで上書きしない） */
const queues = new Map()

function enqueue(questionId, task) {
  const prev = queues.get(questionId) || Promise.resolve()
  const next = prev
    .catch(() => undefined)
    .then(task)
    .finally(() => {
      if (queues.get(questionId) === next) queues.delete(questionId)
    })
  queues.set(questionId, next)
  return next
}

function questionPath(id) {
  // path traversal 防止
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error('invalid_id')
  }
  return path.join(questionsDir, `${id}.json`)
}

function readQuestion(id) {
  try {
    const raw = fs.readFileSync(questionPath(id), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeQuestion(question) {
  const tmp = `${questionPath(question.id)}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(question, null, 2), 'utf-8')
  fs.renameSync(tmp, questionPath(question.id))
}

function touch(question) {
  question.updatedAt = new Date().toISOString()
}

function deleteQuestionFile(id) {
  try {
    fs.unlinkSync(questionPath(id))
  } catch {
    // ignore
  }
}

function listQuestionIds() {
  try {
    return fs
      .readdirSync(questionsDir)
      .filter((name) => name.endsWith('.json'))
      .map((name) => name.replace(/\.json$/, ''))
  } catch {
    return []
  }
}

/** 旧単一ファイル形式があれば質問ごとに分割して移行 */
function migrateLegacyIfNeeded() {
  if (!fs.existsSync(legacyFile)) return
  try {
    const legacy = JSON.parse(fs.readFileSync(legacyFile, 'utf-8'))
    if (!legacy || typeof legacy !== 'object') return
    for (const [id, question] of Object.entries(legacy)) {
      if (!question || typeof question !== 'object') continue
      if (!fs.existsSync(questionPath(id))) {
        const q = { ...question, id, responses: question.responses || {} }
        writeQuestion(q)
      }
    }
    fs.renameSync(legacyFile, `${legacyFile}.migrated`)
  } catch (err) {
    console.error('legacy migrate failed', err)
  }
}

migrateLegacyIfNeeded()

function pruneExpired() {
  const now = Date.now()
  for (const id of listQuestionIds()) {
    const q = readQuestion(id)
    if (!q) continue
    const anchor = new Date(q.updatedAt || q.createdAt || 0).getTime()
    if (now - anchor > TTL_MS) deleteQuestionFile(id)
  }
}

function summaryFirstPerson(question) {
  return typeof question.firstPerson === 'string' && question.firstPerson.trim()
    ? question.firstPerson.trim().slice(0, 10)
    : '俺'
}

function questionTitle(question) {
  return `${summaryFirstPerson(question)}に会いたい？`
}

function listResponses(question) {
  const responses = question.responses || {}
  return Object.values(responses).sort((a, b) => {
    const ta = new Date(a.answeredAt || a.viewedAt || a.createdAt || 0).getTime()
    const tb = new Date(b.answeredAt || b.viewedAt || b.createdAt || 0).getTime()
    return ta - tb
  })
}

function summarize(question) {
  const responses = listResponses(question)
  const answered = responses.filter((r) => r.status === 'answered')
  const yesCount = answered.filter((r) => r.answer === 'yes').length
  const noCount = answered.filter((r) => r.answer === 'no').length
  const pendingCount = responses.filter((r) => r.status !== 'answered').length
  const firstPerson =
    typeof question.firstPerson === 'string' && question.firstPerson.trim()
      ? question.firstPerson.trim().slice(0, 10)
      : '俺'

  return {
    id: question.id,
    label: question.label || '',
    firstPerson,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt || question.createdAt,
    yesCount,
    noCount,
    answeredCount: answered.length,
    pendingCount,
    responseCount: responses.length,
    status: answered.length > 0 ? 'answered' : 'pending',
  }
}

function publicQuestion(question) {
  const summary = summarize(question)
  const responses = listResponses(question).map((r, index) => ({
    id: r.id,
    index: index + 1,
    label: `回答者${index + 1}`,
    status: r.status,
    answer: r.answer,
    viewedAt: r.viewedAt,
    answeredAt: r.answeredAt,
    noPressCount: r.noPressCount ?? 0,
    responseMs: r.responseMs ?? null,
  }))
  return { ...summary, responses }
}

/**  freshest な状態で質問を更新（追記のみ・他人の response を消さない） */
function updateQuestion(id, mutator) {
  return enqueue(id, async () => {
    const question = readQuestion(id)
    if (!question) {
      const err = new Error('not_found')
      err.code = 'not_found'
      throw err
    }
    if (!question.responses) question.responses = {}
    const result = mutator(question)
    touch(question)
    writeQuestion(question)
    return result === undefined ? question : result
  })
}

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http'
  const host = req.headers['x-forwarded-host'] || req.headers.host
  return `${proto}://${host}`
}

function buildOgSvg(payload) {
  const { title, subtitle, result, resultColor, tagline } = payload
  const bg1 = result === 'NO' ? '#ece7ea' : '#ffe3ea'
  const bg2 = result === 'NO' ? '#e0d8dc' : '#ffd9c8'
  const blob = result === 'NO' ? '#c4b4ba' : '#ff8fa3'

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <circle cx="1040" cy="90" r="220" fill="${blob}" opacity="0.45"/>
  <circle cx="120" cy="560" r="200" fill="${result === 'NO' ? '#d2c8cc' : '#ffd6a5'}" opacity="0.5"/>
  <text x="600" y="140" text-anchor="middle" font-size="48" font-family="sans-serif" font-weight="700" fill="#1f1216">${title}</text>
  <text x="600" y="200" text-anchor="middle" font-size="22" font-family="sans-serif" letter-spacing="6" fill="#8a5a64">${subtitle}</text>
  <text x="600" y="390" text-anchor="middle" font-size="180" font-family="sans-serif" font-weight="700" fill="${resultColor}">${result}</text>
  <text x="600" y="500" text-anchor="middle" font-size="28" font-family="sans-serif" fill="#6b4a52">${tagline}</text>
  <text x="600" y="560" text-anchor="middle" font-size="22" font-family="sans-serif" fill="#9a6b74">あなたも気になる人に聞いてみる？</text>
</svg>`
}

function renderOgPng(payload) {
  const svg = buildOgSvg(payload)
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } })
  return resvg.render().asPng()
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function buildShareHtml({ pageUrl, ogImage, title, description, result, resultColor, baseUrl, brandTitle }) {
  const brand = brandTitle || '俺に会いたい？'
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escapeHtml(brand)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(pageUrl)}" />
  <meta property="og:image" content="${escapeHtml(ogImage)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(ogImage)}" />
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:sans-serif;
      background:linear-gradient(165deg,#ffe3ea,#fff0e8,#ffd9c8);color:#1f1216;text-align:center;padding:24px}
    h1{font-size:clamp(3rem,14vw,5rem);color:${resultColor};margin:8px 0}
    a{color:#be123c}
  </style>
</head>
<body>
  <main>
    <p>${escapeHtml(brand)}</p>
    <h1>${escapeHtml(result)}</h1>
    <p>${escapeHtml(description)}</p>
    <p><a href="${escapeHtml(baseUrl)}/?create=1">あなたも質問をつくってみる</a></p>
  </main>
</body>
</html>`
}

const app = express()
app.use(cors())
app.use(express.json())

app.post('/api/questions', (req, res) => {
  pruneExpired()
  const id = randomUUID().slice(0, 8)
  const label =
    typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 40) : ''
  const firstPersonRaw =
    typeof req.body?.firstPerson === 'string' ? req.body.firstPerson.trim().slice(0, 10) : ''
  const firstPerson = firstPersonRaw || '俺'
  const question = {
    id,
    label,
    firstPerson,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    responses: {},
  }
  writeQuestion(question)
  res.json(publicQuestion(question))
})

app.post('/api/questions/batch', (req, res) => {
  pruneExpired()
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 50) : []
  const items = ids
    .map((id) => {
      try {
        return readQuestion(id)
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .map(summarize)
  res.json({ items })
})

app.get('/api/questions/:id', (req, res) => {
  try {
    const question = readQuestion(req.params.id)
    if (!question) return res.status(404).json({ error: 'not_found' })
    res.json(publicQuestion(question))
  } catch {
    res.status(400).json({ error: 'invalid_id' })
  }
})

async function handleUpdateLabel(req, res) {
  try {
    const label =
      typeof req.body?.label === 'string' ? req.body.label.trim().slice(0, 40) : ''
    const question = await updateQuestion(req.params.id, (q) => {
      q.label = label
      return q
    })
    res.json(publicQuestion(question))
  } catch (err) {
    if (err.code === 'not_found') return res.status(404).json({ error: 'not_found' })
    res.status(400).json({ error: 'invalid_id' })
  }
}

/** 作成者用: 相手向けラベルを更新（POST を正とする。一部環境で PATCH が落ちるため） */
app.post('/api/questions/:id/label', handleUpdateLabel)
app.patch('/api/questions/:id', handleUpdateLabel)

/** 回答者用: 既存 responseId があれば返し、なければ新規発行（追記のみ） */
app.post('/api/questions/:id/responses/claim', async (req, res) => {
  try {
    const requested =
      typeof req.body?.responseId === 'string' ? req.body.responseId.trim() : ''

    const result = await updateQuestion(req.params.id, (question) => {
      if (requested && question.responses[requested]) {
        return question.responses[requested]
      }
      const responseId = randomUUID().slice(0, 10)
      const response = {
        id: responseId,
        status: 'pending',
        answer: null,
        createdAt: new Date().toISOString(),
        viewedAt: null,
        answeredAt: null,
        noPressCount: 0,
        responseMs: null,
      }
      // 既存 responses は触らず追記のみ
      question.responses[responseId] = response
      return response
    })
    res.json(result)
  } catch (err) {
    if (err.code === 'not_found') return res.status(404).json({ error: 'not_found' })
    res.status(400).json({ error: 'invalid_id' })
  }
})

app.get('/api/questions/:id/responses/:responseId', (req, res) => {
  try {
    const question = readQuestion(req.params.id)
    const response = question?.responses?.[req.params.responseId]
    if (!response) return res.status(404).json({ error: 'not_found' })
    res.json(response)
  } catch {
    res.status(400).json({ error: 'invalid_id' })
  }
})

app.post('/api/questions/:id/responses/:responseId/view', async (req, res) => {
  try {
    const result = await updateQuestion(req.params.id, (question) => {
      const response = question.responses[req.params.responseId]
      if (!response) {
        const err = new Error('not_found')
        err.code = 'not_found'
        throw err
      }
      if (!response.viewedAt && response.status !== 'answered') {
        response.viewedAt = new Date().toISOString()
      }
      return response
    })
    res.json(result)
  } catch (err) {
    if (err.code === 'not_found') return res.status(404).json({ error: 'not_found' })
    res.status(400).json({ error: 'invalid_id' })
  }
})

app.post('/api/questions/:id/responses/:responseId/answer', async (req, res) => {
  try {
    const answer = req.body?.answer
    if (answer !== 'yes' && answer !== 'no') {
      return res.status(400).json({ error: 'invalid_answer' })
    }

    const result = await updateQuestion(req.params.id, (question) => {
      const response = question.responses[req.params.responseId]
      if (!response) {
        const err = new Error('not_found')
        err.code = 'not_found'
        throw err
      }
      // 二重回答は上書きせず既存を返す
      if (response.status === 'answered') return response

      const now = new Date()
      const start = response.viewedAt
        ? new Date(response.viewedAt)
        : new Date(response.createdAt)

      response.status = 'answered'
      response.answer = answer
      response.answeredAt = now.toISOString()
      response.noPressCount = Number(req.body?.noPressCount) || 0
      response.responseMs = Math.max(0, now.getTime() - start.getTime())
      if (!response.viewedAt) response.viewedAt = response.answeredAt
      return response
    })
    res.json(result)
  } catch (err) {
    if (err.code === 'not_found') return res.status(404).json({ error: 'not_found' })
    res.status(400).json({ error: 'invalid_id' })
  }
})

app.get('/api/share/:questionId', (req, res) => {
  try {
    const question = readQuestion(req.params.questionId)
    if (!question) return res.status(404).json({ error: 'not_found' })

    const responseId = req.query.responseId
    if (typeof responseId === 'string' && question.responses?.[responseId]) {
      const response = question.responses[responseId]
      if (response.status !== 'answered' || !response.answer) {
        return res.status(404).json({ error: 'not_found' })
      }
      return res.json({
        questionId: question.id,
        responseId: response.id,
        mode: 'single',
        answer: response.answer,
        firstPerson: summaryFirstPerson(question),
      })
    }

    const summary = summarize(question)
    if (summary.answeredCount === 0) {
      return res.status(404).json({ error: 'not_found' })
    }
    res.json({
      questionId: question.id,
      mode: 'aggregate',
      yesCount: summary.yesCount,
      noCount: summary.noCount,
      answeredCount: summary.answeredCount,
      answer: summary.yesCount >= summary.noCount ? 'yes' : 'no',
      firstPerson: summary.firstPerson,
    })
  } catch {
    res.status(400).json({ error: 'invalid_id' })
  }
})

app.get('/api/og/:questionId.png', (req, res) => {
  try {
    const question = readQuestion(req.params.questionId)
    if (!question) return res.status(404).json({ error: 'not_found' })

    const responseId = req.query.responseId
    let payload

    if (typeof responseId === 'string' && question.responses?.[responseId]) {
      const response = question.responses[responseId]
      if (response.status !== 'answered' || !response.answer) {
        return res.status(404).json({ error: 'not_found' })
      }
      const yes = response.answer === 'yes'
      payload = {
        title: questionTitle(question),
        subtitle: 'RESULT',
        result: yes ? 'YES' : 'NO',
        resultColor: yes ? '#e11d48' : '#5a3a42',
        tagline: yes ? '会いたい気持ち、届いた。' : '今回は残念…また今度？',
      }
    } else {
      const summary = summarize(question)
      if (summary.answeredCount === 0) {
        return res.status(404).json({ error: 'not_found' })
      }
      const yes = summary.yesCount >= summary.noCount
      payload = {
        title: questionTitle(question),
        subtitle: `YES ${summary.yesCount} / NO ${summary.noCount}`,
        result: yes ? 'YES' : 'NO',
        resultColor: yes ? '#e11d48' : '#5a3a42',
        tagline: `${summary.answeredCount}人が回答`,
      }
    }

    const png = renderOgPng(payload)
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=60')
    res.send(Buffer.from(png))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'og_render_failed' })
  }
})

app.get('/s/:questionId', (req, res, next) => {
  const ua = String(req.headers['user-agent'] || '')
  const isBot =
    /bot|crawl|spider|slurp|facebookexternalhit|Twitterbot|linkedinbot|embedly|quora|pinterest|redditbot|Applebot|Discordbot|TelegramBot|WhatsApp|Line\//i.test(
      ua,
    )
  if (!isBot) return next()

  let question
  try {
    question = readQuestion(req.params.questionId)
  } catch {
    return next()
  }
  if (!question) return next()

  const responseId =
    typeof req.query.r === 'string' ? req.query.r : undefined
  const baseUrl = getBaseUrl(req)
  let title
  let description
  let result
  let resultColor
  let ogImage = `${baseUrl}/api/og/${question.id}.png`

  if (responseId && question.responses?.[responseId]?.status === 'answered') {
    const answer = question.responses[responseId].answer
    const yes = answer === 'yes'
    const titleBase = questionTitle(question)
    title = yes ? `${titleBase} → YES` : `${titleBase} → NO`
    description = yes
      ? '答えは YES でした。あなたも気になる人に聞いてみる？'
      : '答えは NO でした。あなたも気になる人に聞いてみる？'
    result = yes ? 'YES' : 'NO'
    resultColor = yes ? '#e11d48' : '#5a3a42'
    ogImage += `?responseId=${encodeURIComponent(responseId)}`
  } else {
    const summary = summarize(question)
    if (summary.answeredCount === 0) return next()
    const titleBase = questionTitle(question)
    title = `${titleBase} YES ${summary.yesCount} / NO ${summary.noCount}`
    description = `${summary.answeredCount}人が回答。あなたも気になる人に聞いてみる？`
    result = summary.yesCount >= summary.noCount ? 'YES' : 'NO'
    resultColor = result === 'YES' ? '#e11d48' : '#5a3a42'
  }

  const pageUrl = responseId
    ? `${baseUrl}/s/${question.id}?r=${encodeURIComponent(responseId)}`
    : `${baseUrl}/s/${question.id}`

  res.type('html').send(
    buildShareHtml({
      pageUrl,
      ogImage,
      title,
      description,
      result,
      resultColor,
      baseUrl,
      brandTitle: questionTitle(question),
    }),
  )
})

const distPath = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
} else {
  app.use((req, res, next) => {
    if (req.path.startsWith('/s/')) return res.status(204).end()
    next()
  })
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
