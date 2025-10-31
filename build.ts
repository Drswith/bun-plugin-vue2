import vuePlugin from './src/index'

Bun.build({
  entrypoints: ["./x.ts"],
  outdir: "dist",
  plugins: [
    vuePlugin(),
  ],
  // options...
});
