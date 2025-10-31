import app from './index.html';

async function serve() {
  try {
    const server = Bun.serve({
      port: 3000,
      development: true,
      routes: {
        '/': app
      }
    })

    console.log(`Server running at http://localhost:${server.port}`)

  } catch (e) {
    console.error('Server failed to start:')
    console.error(e)
  }
}

if (import.meta.main) {
  serve()
}
