import dts from 'bun-plugin-dts';

const outDir = 'dist';

async function build() {
  try {
    // 删除outdir
    Bun.spawn(['rm', '-rf', outDir]);

    const result = await Bun.build({
      entrypoints: ['./src/index.ts'],
      outdir: outDir,
      sourcemap: true,
      target: 'bun',
      // minify: true,
      minify: false,
      plugins: [dts()],
      // options...
    });

    if (result.logs.length > 0) {
      console.warn('Bun Build succeeded with warnings:');
      for (const message of result.logs) {
        // Bun will pretty print the message object
        console.warn(message);
      }
    }

    if (result.success) {
      console.log('Bun Build completed successfully');
    }
  } catch (e) {
    // console.error('Build failed:', err)
    // TypeScript does not allow annotations on the catch clause
    // const error = e as AggregateError;
    const error = e;
    console.error('Bun Build Failed');

    // Example: Using the built-in formatter
    console.error(error);

    // Example: Serializing the failure as a JSON string.
    // console.error(JSON.stringify(error, null, 2));
  }
}

if (import.meta.main) {
  build();
}
