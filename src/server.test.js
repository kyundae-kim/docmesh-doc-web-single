import { createServer, request as httpRequest } from 'node:http'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../server.mjs'

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      resolve(server.address().port)
    })
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}

function request(port, pathname, { method = 'GET', body = '', headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const clientRequest = httpRequest(
      {
      host: '127.0.0.1',
      port,
      path: pathname,
        method,
        headers,
      },
      (response) => {
        const chunks = []
        response.on('data', (chunk) => chunks.push(chunk))
        response.on('end', () => {
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks).toString(),
          })
        })
      },
    )
    clientRequest.on('error', reject)
    clientRequest.end(body)
  })
}

describe('Node web server', () => {
  let apiServer
  let webServer
  let distDir
  let webPort
  let apiPort
  let upstreamRequests
  let upstreamHeaders

  beforeEach(async () => {
    upstreamRequests = []
    upstreamHeaders = []
    distDir = await mkdtemp(join(tmpdir(), 'docmesh-web-'))
    await mkdir(join(distDir, 'assets'))
    await writeFile(join(distDir, 'index.html'), '<html><body>DocMesh shell</body></html>')
    await writeFile(join(distDir, 'assets', 'app.js'), 'console.log("ok")')

    apiServer = createServer((request, response) => {
      const chunks = []
      request.on('data', (chunk) => chunks.push(chunk))
      request.on('end', () => {
        upstreamHeaders.push(request.headers)
        upstreamRequests.push({
          method: request.method,
          url: request.url,
          body: Buffer.concat(chunks).toString(),
        })
        if (request.url.startsWith('/documents/binary')) {
          response.statusCode = 200
          response.setHeader('content-type', 'text/plain')
          response.setHeader('content-length', '11')
          response.setHeader('content-disposition', 'inline; filename="binary.txt"')
          response.setHeader('x-document-checksum', 'sha256:binary')
          response.setHeader('x-checksum-verified', 'true')
          response.end('binary-body')
          return
        }
        if (request.method === 'POST' && request.url.startsWith('/documents')) {
          response.setHeader('location', '/documents/upstream-created')
        }
        response.setHeader('content-type', 'application/json')
        response.end(JSON.stringify({ ok: true, path: request.url }))
      })
    })
    apiPort = await listen(apiServer)

    const app = createApp({ distDir, apiTarget: `http://127.0.0.1:${apiPort}` })
    webServer = createServer(app)
    webPort = await listen(webServer)
  })

  afterEach(async () => {
    await close(webServer)
    await close(apiServer)
    await rm(distDir, { recursive: true, force: true })
  })

  it('serves health, static assets, and the SPA fallback', async () => {
    const health = await request(webPort, '/health')
    const asset = await request(webPort, '/assets/app.js')
    const route = await request(webPort, '/documents')

    expect(health.status).toBe(200)
    expect(health.body).toBe('ok\n')
    expect(asset.status).toBe(200)
    expect(asset.body).toContain('console.log')
    expect(route.status).toBe(200)
    expect(route.body).toContain('DocMesh shell')
  })

  it('proxies API requests while removing the /api prefix and streaming bodies', async () => {
    const response = await request(webPort, '/api/documents?limit=1', {
      method: 'POST',
      body: 'uploaded-content',
      headers: { 'content-type': 'application/octet-stream' },
    })

    expect(response.status).toBe(200)
    expect(JSON.parse(response.body)).toEqual({ ok: true, path: '/documents?limit=1' })
    expect(response.headers.location).toBe('/documents/upstream-created')
    expect(upstreamRequests).toEqual([
      { method: 'POST', url: '/documents?limit=1', body: 'uploaded-content' },
    ])
  })

  it('preserves binary response headers through the BFF', async () => {
    const response = await request(webPort, '/api/documents/binary')

    expect(response.status).toBe(200)
    expect(response.body).toBe('binary-body')
    expect(response.headers['content-type']).toContain('text/plain')
    expect(response.headers['content-length']).toBe('11')
    expect(response.headers['content-disposition']).toContain('binary.txt')
    expect(response.headers['x-document-checksum']).toBe('sha256:binary')
    expect(response.headers['x-checksum-verified']).toBe('true')
  })

  it('provides liveness and blocks operator-only API routes at the BFF', async () => {
    const liveness = await request(webPort, '/health/liveness')
    const blocked = await request(webPort, '/api/management/data', {
      method: 'DELETE',
      headers: { 'x-correlation-id': 'operator-check' },
    })

    expect(liveness.status).toBe(200)
    expect(JSON.parse(liveness.body)).toEqual({ status: 'ok' })
    expect(blocked.status).toBe(403)
    expect(JSON.parse(blocked.body)).toEqual({
      error: {
        code: 'FORBIDDEN',
        message: 'This operation is restricted to an operator environment.',
        correlation_id: 'operator-check',
      },
    })
    expect(blocked.headers['x-correlation-id']).toBe('operator-check')
    expect(upstreamRequests).toEqual([])
  })

  it('blocks hard-delete query variants before they reach the application', async () => {
    const blocked = await request(webPort, '/api/documents/doc-1?hard=true', {
      method: 'DELETE',
      headers: { 'x-correlation-id': 'hard-delete-check' },
    })

    expect(blocked.status).toBe(403)
    expect(blocked.headers['x-correlation-id']).toBe('hard-delete-check')
    expect(upstreamRequests).toEqual([])
  })

  it('does not forward unverified DMS context headers from browser requests', async () => {
    await request(webPort, '/api/documents', {
      headers: {
        'x-subject': 'spoofed-user',
        'x-tenant-id': 'spoofed-tenant',
        'x-correlation-id': 'request-correlation',
      },
    })

    expect(upstreamRequests).toHaveLength(1)
    expect(upstreamHeaders[0]).not.toHaveProperty('x-subject')
    expect(upstreamHeaders[0]).not.toHaveProperty('x-tenant-id')
    expect(upstreamHeaders[0]['x-correlation-id']).toBe('request-correlation')
  })

  it('returns the public error envelope when the upstream is unreachable', async () => {
    const failingWebServer = createServer(createApp({ distDir, apiTarget: 'http://127.0.0.1:1' }))
    const failingPort = await listen(failingWebServer)

    try {
      const response = await request(failingPort, '/api/documents', {
        headers: { 'x-correlation-id': 'upstream-unavailable' },
      })

      expect(response.status).toBe(502)
      expect(response.headers['x-correlation-id']).toBe('upstream-unavailable')
      expect(JSON.parse(response.body)).toEqual({
        error: {
          code: 'BFF_UPSTREAM_ERROR',
          message: 'The document service is unavailable.',
          correlation_id: 'upstream-unavailable',
        },
      })
    } finally {
      await close(failingWebServer)
    }
  })

  it('supports a ROOT_PATH-aware API prefix without changing upstream paths', async () => {
    const prefixedWebServer = createServer(createApp({ distDir, apiTarget: `http://127.0.0.1:${apiPort}`, apiPrefix: '/dms/api' }))
    const prefixedPort = await listen(prefixedWebServer)

    try {
      const response = await request(prefixedPort, '/dms/api/documents?limit=2')
      const blocked = await request(prefixedPort, '/dms/api/management/data', { method: 'DELETE' })

      expect(response.status).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ ok: true, path: '/documents?limit=2' })
      expect(blocked.status).toBe(403)
      expect(upstreamRequests).toHaveLength(1)
    } finally {
      await close(prefixedWebServer)
    }
  })

  it('forwards operator routes only when the BFF is explicitly enabled', async () => {
    const operatorWebServer = createServer(createApp({ distDir, apiTarget: `http://127.0.0.1:${apiPort}`, allowOperatorRoutes: true }))
    const operatorPort = await listen(operatorWebServer)

    try {
      const response = await request(operatorPort, '/api/management/data')

      expect(response.status).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ ok: true, path: '/management/data' })
      expect(upstreamRequests.at(-1)).toEqual({ method: 'GET', url: '/management/data', body: '' })
    } finally {
      await close(operatorWebServer)
    }
  })
})
