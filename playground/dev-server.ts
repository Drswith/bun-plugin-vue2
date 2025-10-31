import { serve } from "bun";
// import app from './index.html';
import app from './simple-test.html';


async function devServer() {
  try {
    const server = serve({
      port: 3000,
      routes: {
        '/*': app
      },
      development: process.env.NODE_ENV !== "production" && {
        // Enable browser hot reloading in development
        hmr: true,

        // Echo console logs from the browser to the server
        console: true,
      },

    })

    console.log(`🚀 Server running at ${server.url}`);

  } catch (e) {
    console.error('Server failed to start:')
    console.error(e)
  }
}

if (import.meta.main) {
  devServer()
}
