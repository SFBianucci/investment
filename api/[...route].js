import { createApp } from '../src/app.js'

const app = createApp({ serveStatic: false })

export const config = {
  maxDuration: 60,
}

export default (req, res) => {
  if (req.url === '/api') req.url = '/'
  else if (req.url?.startsWith('/api/')) req.url = req.url.slice(4)
  return app(req, res)
}
