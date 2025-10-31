import fs from 'node:fs'
import path from 'node:path'
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
import { createFilter } from './utils/filter'
import { getDescriptor, getSrcDescriptor } from './utils/descriptorCache'
import { getResolvedScript } from './script'
import { transformMain } from './main'
import { transformTemplateAsModule } from './template'
import { transformStyle } from './style'
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
  devServer?: any // Simplified type for Bun environment
  devToolsEnabled?: boolean
}

export default function vuePlugin(rawOptions: Options = {}): BunPlugin {

  const {
    include = /\.vue$/,
    exclude
    // customElement = /\.ce\.vue$/,
    // reactivityTransform = false
  } = rawOptions

  const filter = createFilter(include, exclude)

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

  async function transform(
    code: string,
    id: string,
    opt: { ssr?: boolean } | undefined
  ) {
    const ssr = opt?.ssr === true
      const { filename, query } = parseVueRequest(id)
      if (query.raw) {
        return
      }
      if (!filter(filename) && !query.vue) {
        // if (
        //   !query.vue &&
        //   refTransformFilter(filename) &&
        //   options.compiler.shouldTransformRef(code)
        // ) {
        //   return options.compiler.transformRef(code, {
        //     filename,
        //     sourceMap: true
        //   })
        // }
        return
      }

      if (!query.vue) {
        // main request
        return transformMain(code, filename, options, this, ssr)
      } else {
        // sub block request
        const descriptor = query.src
          ? getSrcDescriptor(filename, query)!
          : getDescriptor(filename, options)!

        if (query.type === 'template') {
          return {
            code: await transformTemplateAsModule(
              code,
              descriptor,
              options,
              this,
              ssr
            ),
            map: {
              mappings: ''
            }
          }
        } else if (query.type === 'style') {
          return transformStyle(
            code,
            descriptor,
            Number(query.index),
            options,
            this,
            filename
          )
        }
      }
  }


  return {
    name: 'bun:vue2',
    setup(build) {

      const transpiler = new Bun.Transpiler();

		  let trackedImports: Record<string, number> = {};

      // ==================== configResolved start ====================

      // options = {
      //   ...options,
      //   root: build.config.root,
      //   isProduction: build.config.isProduction,
      //   sourceMap: build.config.command === 'build' ? !!build.config.build.sourcemap : true,
      //   cssDevSourcemap: build.config.css?.devSourcemap ?? false,
      //   devToolsEnabled: !build.config.isProduction
      // }

      // if (!build.config.resolve.alias.some(({ find }) => find === 'vue')) {
      //   build.config.resolve.alias.push({
      //     find: 'vue',
      //     replacement: 'vue/dist/vue.runtime.esm.js'
      //   })
      // }

      // build.onResolve({ filter: /.*/ }, args => {
      //   console.log(args.path);

      //   if (args.path === 'vue') {
      //     return { path: path.join(process.cwd(), 'node_modules', 'vue/dist/vue.runtime.esm.js')}
      //   }
      //   return undefined
      // })

      // ==================== configResolved end ====================


      // ==================== configureServer start ====================
      // configureServer(server) {
      //   options.devServer = server
      // },

      // build.config.???


      // ==================== configureServer end ======================

      // ==================== buildStart start ====================

      build.onStart(() => {
        console.log("Bundle started!");
        options.compiler = options.compiler || resolveCompiler(options.root)
      });

      // ==================== buildStart end ======================

      // ==================== resolveId start ====================

      build.onResolve({ filter: /.*/, namespace: "file" }, ({ path: id }) => {

        // component export helper
        if (id === NORMALIZER_ID || id === HMR_RUNTIME_ID) {
          return { path: id }
        }
        // serve sub-part requests (*?vue) as virtual modules
        if (parseVueRequest(id).query.vue) {
          return { path: id }
        }

      });

      // ==================== resolveId end ======================

      build.onLoad({ filter: /.*/, namespace: "file" }, ({ path: id, namespace, loader, defer }) => {
        // const ssr = opt?.ssr === true
        const ssr = false
        if (id === NORMALIZER_ID) {
          return { contents: normalizerCode, loader: 'js' }
        }
        if (id === HMR_RUNTIME_ID) {
          return { contents: hmrRuntimeCode, loader: 'js' }
        }
        const { filename, query } = parseVueRequest(id)
        // select corresponding block for sub-part virtual modules
        if (query.vue) {
          if (query.src) {
            return { contents: fs.readFileSync(filename, 'utf-8'), loader: 'js' }
          }
          const descriptor = getDescriptor(filename, options)!
          let block: SFCBlock | null | undefined
          if (query.type === 'script') {
            // handle <scrip> + <script setup> merge via compileScript()
            block = getResolvedScript(descriptor, ssr)
          } else if (query.type === 'template') {
            block = descriptor.template!
          } else if (query.type === 'style') {
            block = descriptor.styles[query.index!]
          } else if (query.index != null) {
            block = descriptor.customBlocks[query.index]
          }

          if (block) {
            // return {
            //   code: block.content,
            //   map: block.map as any
            // }
            return { contents: block.content, loader: 'js' }
          }
        }



        return undefined
      });






      // build.onResolve({ filter: /.*/, namespace: "file" }, args => {
      //   if (args.path.startsWith("images/")) {
      //     return {
      //       path: args.path.replace("images/", "./public/images/"),
      //     };
      //   }
      // });

      // build.onLoad({ filter: /env/, namespace: "file" }, args => {
      //   return {
      //     contents: `export default ${JSON.stringify(process.env)}`,
      //     loader: "js",
      //   };
      // });

      // Each module that goes through this onLoad callback
      // will record its imports in `trackedImports`
      // build.onLoad({ filter: /\.ts/ }, async ({ path }) => {
      //   const contents = await Bun.file(path).arrayBuffer();

      //   const imports = transpiler.scanImports(contents);

      //   for (const i of imports) {
      //     trackedImports[i.path] = (trackedImports[i.path] || 0) + 1;
      //   }

      //   return undefined;
      // });

      // build.onLoad({ filter: /stats\.json/ }, async ({ defer }) => {
      //   // Wait for all files to be loaded, ensuring
      //   // that every file goes through the above `onLoad()` function
      //   // and their imports tracked
      //   await defer();

      //   console.log("Bundle finished!");
      //   console.log("trackedImports:", trackedImports);

      //   // Emit JSON containing the stats of each import
      //   return {
      //     contents: `export default ${JSON.stringify(trackedImports)}`,
      //     loader: "json",
      //   };
      // });

    }
  }

}
