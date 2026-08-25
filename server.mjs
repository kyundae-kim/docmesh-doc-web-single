import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const projectDir = path.dirname(fileURLToPath(import.meta.url))
const defaultDistDir = path.join(projectDir, 'dist')
const defaultApiTarget = 'http://docmesh-doc:8000'
const contextHeaders = [
  'x-subject',
  'x-user-id',
  'x-tenant-id',
  'x-roles',
  'x-created-by',
  'x-idempotency-scope',
  'x-audit-actor',
  'x-default-metadata',
]

function correlationId(request) {
  const candidate = request.get('x-correlation-id')
  return candidate && /^[\x20-\x7e]{1,128}$/.test(candidate) ? candidate : randomUUID()
}

function isOperatorRoute(request) {
  const parsed = new URL(request.originalUrl, 'http://localhost')
  let apiPath = parsed.pathname.replace(/^\/api(?=\/|$)/, '')
  try {
    apiPath = decodeURIComponent(apiPath)
  } catch {
    return true
  }
  if (apiPath === '/management' || apiPath.startsWith('/management/')) return true
  if (apiPath.endsWith('/hard')) return true
  return request.method === 'DELETE' && parsed.searchParams.get('hard')?.toLowerCase() === 'true' && /^\/documents\/[^/]+$/.test(apiPath)
}

export function createApp({
  distDir = defaultDistDir,
  apiTarget = process.env.API_TARGET || defaultApiTarget,
  allowOperatorRoutes = process.env.ALLOW_OPERATOR_ROUTES === 'true',
  forwardContextHeaders = process.env.FORWARD_TRUSTED_CONTEXT_HEADERS === 'true',
} = {}) {
  const app = express()
  app.disable('x-powered-by')

  app.get('/health', (_request, response) => {
    response.type('text/plain').send('ok\n')
  })

  app.get('/health/liveness', (_request, response) => {
    response.json({ status: 'ok' })
  })

  app.use('/api', (request, response, next) => {
    if (!allowOperatorRoutes && isOperatorRoute(request)) {
      const id = correlationId(request)
      response.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'This operation is restricted to an operator environment.',
          correlation_id: id,
        },
      })
      return
    }
    next()
  })

  // Mounting at /api removes that prefix before the request reaches DocMesh.
  // Do not add body-parsing middleware before this proxy: uploads are streamed.
  app.use(
    '/api',
    createProxyMiddleware({
      target: apiTarget,
      changeOrigin: true,
      proxyTimeout: 300000,
      timeout: 300000,
      on: {
        proxyReq: (proxyRequest) => {
          if (forwardContextHeaders) return
          contextHeaders.forEach((header) => proxyRequest.removeHeader(header))
        },
      },
    }),
  )

  app.use(express.static(distDir))

  // Vite's client-side routes must resolve to the application shell on refresh.
  app.use((request, response, next) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return next()
    }

    return response.sendFile(path.join(distDir, 'index.html'), (error) => {
      if (error) next(error)
    })
  })

  app.use((error, _request, response, _next) => {
    if (response.headersSent) return
    response.status(500).json({ error: 'Web server request failed.' })
  })

  return app
}

export function startServer({ port = Number(process.env.PORT || 8080), apiTarget } = {}) {
  const app = createApp({ apiTarget })
  return app.listen(port, '0.0.0.0', () => {
    console.log(`DocMesh web server listening on port ${port}`)
  })
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMainModule) {
  startServer()
}
