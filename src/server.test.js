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

  beforeEach(async () => {
    upstreamRequests = []
    distDir = await mkdtemp(join(tmpdir(), 'docmesh-web-'))
    await mkdir(join(distDir, 'assets'))
    await writeFile(join(distDir, 'index.html'), '<html><body>DocMesh shell</body></html>')
    await writeFile(join(distDir, 'assets', 'app.js'), 'console.log("ok")')

    apiServer = createServer((request, response) => {
      const chunks = []
      request.on('data', (chunk) => chunks.push(chunk))
      request.on('end', () => {
        upstreamRequests.push({
          method: request.method,
          url: request.url,
          body: Buffer.concat(chunks).toString(),
        })
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
    expect(upstreamRequests).toEqual([
      { method: 'POST', url: '/documents?limit=1', body: 'uploaded-content' },
    ])
  })
})
