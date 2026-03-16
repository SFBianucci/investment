import app from '../src/server.js'

export default (req, res) => {
  if (req.url?.startsWith('/api')) {
    req.url = req.url.replace(/^\/api/, '') || '/'
  }
  return app(req, res)
}
