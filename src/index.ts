import fs from 'node:fs'
import type { BunPlugin } from 'bun'
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

  return {
    name: 'bun:vue2',
    setup(build) {

    }
  }

}
