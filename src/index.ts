import fs from 'node:fs'
import type { BunPlugin } from 'bun'
import process from 'node:process'
import type {
  SFCBlock,
  SFCScriptCompileOptions,
  SFCStyleCompileOptions,
  SFCTemplateCompileOptions
} from 'vue/compiler-sfc'
import type * as _compiler from 'vue/compiler-sfc'
import { resolveCompiler } from './compiler'
import { parseVueRequest } from './utils/query'
import { getDescriptor, getSrcDescriptor } from './utils/descriptorCache'
import { NORMALIZER_ID, normalizerCode } from './utils/componentNormalizer'
import { HMR_RUNTIME_ID, hmrRuntimeCode } from './utils/hmrRuntime'


export { parseVueRequest } from './utils/query'
export type { VueQuery } from './utils/query'

export interface Options {
  include?: string | RegExp | (string | RegExp)[]
  exclude?: string | RegExp | (string | RegExp)[]

  isProduction?: boolean

  // options to pass on to vue/compiler-sfc
  script?: Partial<Pick<SFCScriptCompileOptions, 'babelParserPlugins'>>
  template?: Partial<
    Pick<
      SFCTemplateCompileOptions,
      | 'compiler'
      | 'compilerOptions'
      | 'preprocessOptions'
      | 'transpileOptions'
      | 'transformAssetUrls'
      | 'transformAssetUrlsOptions'
    >
  >
  style?: Partial<Pick<SFCStyleCompileOptions, 'trim'>>

  // customElement?: boolean | string | RegExp | (string | RegExp)[]
  // reactivityTransform?: boolean | string | RegExp | (string | RegExp)[]
  compiler?: typeof _compiler
}

export interface ResolvedOptions extends Options {
  compiler: typeof _compiler
  root: string
  sourceMap: boolean
  cssDevSourcemap: boolean
  // devServer?: ViteDevServer
  devToolsEnabled?: boolean
}

export default function vuePlugin(rawOptions: Options = {}): BunPlugin {

  const {
    include = /\.vue$/,
    exclude
    // customElement = /\.ce\.vue$/,
    // reactivityTransform = false
  } = rawOptions

  let options: ResolvedOptions = {
    isProduction: process.env.NODE_ENV === 'production',
    compiler: null as any, // to be set in buildStart
    ...rawOptions,
    include,
    exclude,
    // customElement,
    // reactivityTransform,
    root: process.cwd(),
    sourceMap: true,
    cssDevSourcemap: false,
    devToolsEnabled: process.env.NODE_ENV !== 'production'
  }



  return {
    name: 'bun:vue2',
    setup(build) {

      const transpiler = new Bun.Transpiler();

		  let trackedImports: Record<string, number> = {};


      build.onStart(() => {
        console.log("Bundle started!");
      });

      build.onResolve({ filter: /.*/, namespace: "file" }, args => {
        if (args.path.startsWith("images/")) {
          return {
            path: args.path.replace("images/", "./public/images/"),
          };
        }
      });

      build.onLoad({ filter: /env/, namespace: "file" }, args => {
        return {
          contents: `export default ${JSON.stringify(process.env)}`,
          loader: "js",
        };
      });

      // Each module that goes through this onLoad callback
      // will record its imports in `trackedImports`
      build.onLoad({ filter: /\.ts/ }, async ({ path }) => {
        const contents = await Bun.file(path).arrayBuffer();

        const imports = transpiler.scanImports(contents);

        for (const i of imports) {
          trackedImports[i.path] = (trackedImports[i.path] || 0) + 1;
        }

        return undefined;
      });

      build.onLoad({ filter: /stats\.json/ }, async ({ defer }) => {
        // Wait for all files to be loaded, ensuring
        // that every file goes through the above `onLoad()` function
        // and their imports tracked
        await defer();

        console.log("Bundle finished!");
        console.log("trackedImports:", trackedImports);

        // Emit JSON containing the stats of each import
        return {
          contents: `export default ${JSON.stringify(trackedImports)}`,
          loader: "json",
        };
      });

    }
  }

}
