import fs from 'node:fs'
import path from 'node:path'
import type { BunPlugin, OnLoadResult } from 'bun'
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

// Mock plugin context for Bun environment
class BunPluginContext {
  error(err: any) {
    console.error('Vue Plugin Error:', err)
    throw new Error(err.message || err)
  }

  warn(warning: any) {
    console.warn('Vue Plugin Warning:', warning.message || warning)
  }

  emitFile(file: any) {
    // In Bun environment, we handle file emission differently
    console.log('Emit file:', file)
  }
}

export default function vuePlugin(rawOptions: Options = {}): BunPlugin {
  const {
    include = /\.vue$/,
    exclude
  } = rawOptions

  const filter = createFilter(include, exclude)

  let options: ResolvedOptions = {
    isProduction: process.env.NODE_ENV === 'production',
    compiler: null as any, // to be set in buildStart
    ...rawOptions,
    include,
    exclude,
    root: process.cwd(),
    sourceMap: true,
    cssDevSourcemap: false,
    devToolsEnabled: process.env.NODE_ENV !== 'production'
  }

  const pluginContext = new BunPluginContext()

  async function transformCode(
    code: string,
    id: string,
    ssr: boolean = false
  ): Promise<OnLoadResult | undefined> {
    const { filename, query } = parseVueRequest(id)

    if (query.raw) {
      return undefined
    }

    if (!filter(filename) && !query.vue) {
      return undefined
    }

    if (!query.vue) {
      // main request
      const result = await transformMain(code, filename, options, pluginContext as any, ssr)
      if (result) {
        const resultCode = typeof result === 'string' ? result : result.code
        return {
          contents: resultCode,
          loader: 'js'
        }
      }
    } else {
      // sub block request
      const descriptor = query.src
        ? getSrcDescriptor(filename, query)!
        : getDescriptor(filename, options)!

      if (query.type === 'template') {
        const templateCode = await transformTemplateAsModule(
          code,
          descriptor,
          options,
          pluginContext as any,
          ssr
        )
        return {
          contents: templateCode,
          loader: 'js'
        }
      } else if (query.type === 'style') {
        const styleResult = await transformStyle(
          code,
          descriptor,
          Number(query.index),
          options,
          pluginContext as any,
          filename
        )
        if (styleResult) {
          return {
            contents: styleResult.code,
            loader: 'css'
          }
        }
      }
    }

    return undefined
  }

  return {
    name: 'bun:vue2',
    setup(build) {
      // Initialize compiler on build start
      build.onStart(() => {
        console.log("Vue2 Plugin: Bundle started!")
        options.compiler = options.compiler || resolveCompiler(options.root)
      })

      // Handle Vue component resolution
      build.onResolve({ filter: /.*/ }, ({ path: id }) => {
        // component export helper
        if (id === NORMALIZER_ID || id === HMR_RUNTIME_ID) {
          return { path: id, namespace: 'vue-helper' }
        }

        // serve sub-part requests (*?vue) as virtual modules
        const { query } = parseVueRequest(id)
        if (query.vue) {
          return { path: id, namespace: 'vue-sfc' }
        }

        // Handle .vue files
        if (id.endsWith('.vue')) {
          return { path: id, namespace: 'vue-main' }
        }

        return undefined
      })

      // Load helper modules
      build.onLoad({ filter: /.*/, namespace: 'vue-helper' }, ({ path: id }) => {
        if (id === NORMALIZER_ID) {
          return { contents: normalizerCode, loader: 'js' }
        }
        if (id === HMR_RUNTIME_ID) {
          return { contents: hmrRuntimeCode, loader: 'js' }
        }
        return undefined
      })

      // Load Vue SFC main files
      build.onLoad({ filter: /\.vue$/, namespace: 'vue-main' }, async ({ path: id }) => {
        try {
          const code = await Bun.file(id).text()
          const result = await transformCode(code, id, false)
          return result
        } catch (error) {
          console.error(`Error loading Vue file ${id}:`, error)
          throw error
        }
      })

      // Load Vue SFC sub-parts (template, style, script blocks)
      build.onLoad({ filter: /.*/, namespace: 'vue-sfc' }, async ({ path: id }) => {
        try {
          const { filename, query } = parseVueRequest(id)

          if (query.src) {
            // Resolve the src file path relative to the Vue file
            const srcPath = path.resolve(path.dirname(filename), query.src)
            const code = await Bun.file(srcPath).text()
            
            // Determine loader based on file extension
            let loader: 'js' | 'ts' | 'css' | 'text' = 'js'
            if (srcPath.endsWith('.ts')) loader = 'ts'
            else if (srcPath.endsWith('.css')) loader = 'css'
            else if (srcPath.endsWith('.html')) loader = 'text'
            
            return { contents: code, loader }
          }

          const descriptor = getDescriptor(filename, options)!
          let block: SFCBlock | null | undefined

          if (query.type === 'script') {
            // handle <script> + <script setup> merge via compileScript()
            block = getResolvedScript(descriptor, false)
          } else if (query.type === 'template') {
            block = descriptor.template!
          } else if (query.type === 'style') {
            block = descriptor.styles[query.index!]
          } else if (query.index != null) {
            block = descriptor.customBlocks[query.index]
          }

          if (block) {
            // For script blocks, we need to handle TypeScript properly
            if (query.type === 'script') {
              const result = await transformCode(block.content, id, false)
              return result || { contents: block.content, loader: block.lang === 'ts' ? 'ts' : 'js' }
            } else {
              // For other blocks, use appropriate loader
              let loader: 'js' | 'ts' | 'css' | 'text' = 'js'
              if (query.type === 'style') loader = 'css'
              else if (query.type === 'template') loader = 'text'
              
              return { contents: block.content, loader }
            }
          }

          return undefined
        } catch (error) {
          console.error(`Error loading Vue SFC part ${id}:`, error)
          throw error
        }
      })

      // Handle regular .vue files in file namespace
      build.onLoad({ filter: /\.vue$/, namespace: 'file' }, async ({ path: id }) => {
        try {
          const code = await Bun.file(id).text()
          const result = await transformCode(code, id, false)
          return result
        } catch (error) {
          console.error(`Error loading Vue file ${id}:`, error)
          throw error
        }
      })

      // Note: build.onEnd is not implemented in Bun yet
      // See: https://github.com/oven-sh/bun/issues/2771
    }
  }
}
