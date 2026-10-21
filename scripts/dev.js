#!/usr/bin/env node

const { spawn } = require('node:child_process')
const http = require('node:http')
const net = require('node:net')

const PORT = Number(process.env.DEV_PORT || 3000)
const TARGETS = {
  play: 9000,
  perf: 9001,
  docs: 9002
}

const targetPort = (url = '/') => {
  if (url.startsWith('/play')) return TARGETS.play
  if (url.startsWith('/perf')) return TARGETS.perf
  return TARGETS.docs
}

const proxyRequest = (req, res) => {
  const port = targetPort(req.url)
  const headers = { ...req.headers, host: `127.0.0.1:${port}` }
  const upstream = http.request(
    {
      hostname: '127.0.0.1',
      port,
      path: req.url,
      method: req.method,
      headers
    },
    (response) => {
      res.writeHead(response.statusCode ?? 502, response.headers)
      response.pipe(res)
    }
  )

  upstream.on('error', () => {
    if (!res.headersSent) {
      res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
    }
    res.end(`Waiting for local app on port ${port}...`)
  })

  req.pipe(upstream)
}

const server = http.createServer(proxyRequest)

server.on('upgrade', (req, socket, head) => {
  const port = targetPort(req.url)
  const upstream = net.connect(port, '127.0.0.1', () => {
    const requestLine = `${req.method} ${req.url} HTTP/1.1\r\n`
    const headerLines = Object.entries(req.headers)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
      .join('\r\n')
    upstream.write(`${requestLine}${headerLines}\r\n\r\n`)
    if (head.length) {
      upstream.write(head)
    }
    upstream.pipe(socket)
    socket.pipe(upstream)
  })
  upstream.on('error', () => socket.end())
  socket.on('error', () => upstream.end())
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ARWES local site: http://127.0.0.1:${PORT}`)
})

const turbo = spawn(
  'pnpm',
  ['exec', 'turbo', 'dev', '-F', 'apps-docs', '-F', 'apps-play', '-F', 'apps-perf', '--parallel'],
  { stdio: 'inherit', env: process.env }
)

const shutdown = () => {
  turbo.kill('SIGTERM')
  server.close()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
turbo.on('exit', (code) => {
  server.close()
  process.exit(code ?? 0)
})
