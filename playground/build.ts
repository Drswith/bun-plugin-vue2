import vuePlugin from '../src/index'

async function build() {
  try {
    const result = await Bun.build({
      entrypoints: ["./simple-test.html"],
      outdir: "dist",
      sourcemap: true,
      target: "browser",
      // minify: true,
      minify: false,
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      env: "BUN_PUBLIC_*",
      plugins: [
        vuePlugin(),
      ],
      // options...
    })

    if (result.logs.length > 0) {
      console.warn("Bun Build succeeded with warnings:");
      for (const message of result.logs) {
        // Bun will pretty print the message object
        console.warn(message);
      }
    }


    if (result.success) {
      console.log('Bun Build completed successfully')
    }

  } catch (e) {
    // console.error('Build failed:', err)
    // TypeScript does not allow annotations on the catch clause
    // const error = e as AggregateError;
    const error = e;
    console.error("Bun Build Failed");

    // Example: Using the built-in formatter
    console.error(error);

    // Example: Serializing the failure as a JSON string.
    // console.error(JSON.stringify(error, null, 2));
  }
}

if (import.meta.main) {
  build()
}
