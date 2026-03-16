import { createApp } from './app.js'

const app = createApp({ serveStatic: true })
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`\nPortfolio Tracker API corriendo en http://localhost:${PORT}`)
  console.log(`Endpoints disponibles en http://localhost:${PORT}\n`)
})
