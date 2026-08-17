import express from 'express'
import { createProxyMiddleware } from 'http-proxy-middleware'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectDir = path.dirname(fileURLToPath(import.meta.url))
const defaultDistDir = path.join(projectDir, 'dist')
const defaultApiTarget = 'http://docmesh-doc:8000'

export function createApp({ distDir = defaultDistDir, apiTarget = process.env.API_TARGET || defaultApiTarget } = {}) {
  const app = express()
  app.disable('x-powered-by')

  app.get('/health', (_request, response) => {
    response.type('text/plain').send('ok\n')
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
