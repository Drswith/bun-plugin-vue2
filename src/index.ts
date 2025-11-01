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
import { NORMALIZER_MODULE_ID, NORMALIZER_ID, normalizerCode } from './utils/componentNormalizer'
import { HMR_RUNTIME_MODULE_ID, HMR_RUNTIME_ID, hmrRuntimeCode } from './utils/hmrRuntime'
import {
  normalizePath,
  tryStatSync,
  isFileReadable,
  isDirectory,
  tryResolveRealFile,
  tryResolveRealFileWithExtensions,
  tryResolveRealFileOrType,
  isInNodeModules,
  findNearestPackageData,
  resolvePackageEntry,
  createResolvedId,
  bareImportRE,
  deepImportRE,
  DEFAULT_EXTENSIONS,
  DEFAULT_MAIN_FIELDS
} from './utils/resolve'


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

export interface PluginContextMeta {
	rollupVersion: string;
	watchMode: boolean;
}

export interface MinimalPluginContext {
	meta: PluginContextMeta;
}
export interface CustomPluginOptions {
	[plugin: string]: any;
}

interface ModuleOptions {
	meta: CustomPluginOptions;
	moduleSideEffects: boolean | 'no-treeshake';
	syntheticNamedExports: boolean | string;
}

export interface ResolvedId extends ModuleOptions {
	external: boolean | 'absolute';
	id: string;
}

export interface PluginContext extends MinimalPluginContext {
	addWatchFile: (id: string) => void;
	// cache: PluginCache;
	// /** @deprecated Use `this.emitFile` instead */
	// emitAsset: EmitAsset;
	// /** @deprecated Use `this.emitFile` instead */
	// emitChunk: EmitChunk;
	// emitFile: EmitFile;

  error: typeof console.error;
	// error: (err: RollupError | string, pos?: number | { column: number; line: number }) => never;


  // /** @deprecated Use `this.getFileName` instead */
	// getAssetFileName: (assetReferenceId: string) => string;
	// /** @deprecated Use `this.getFileName` instead */
	// getChunkFileName: (chunkReferenceId: string) => string;
	// getFileName: (fileReferenceId: string) => string;
	// getModuleIds: () => IterableIterator<string>;
	// getModuleInfo: GetModuleInfo;
	// getWatchFiles: () => string[];
	// /** @deprecated Use `this.resolve` instead */
	// isExternal: IsExternal;
	// load: (
	// 	options: { id: string; resolveDependencies?: boolean } & Partial<PartialNull<ModuleOptions>>
	// ) => Promise<ModuleInfo>;
	// /** @deprecated Use `this.getModuleIds` instead */
	// moduleIds: IterableIterator<string>;
	// parse: (input: string, options?: any) => AcornNode;
	resolve: (
		source: string,
		importer?: string,
		options?: { custom?: CustomPluginOptions; isEntry?: boolean; skipSelf?: boolean }
	) => Promise<ResolvedId | null>;
	// /** @deprecated Use `this.resolve` instead */
	// resolveId: (source: string, importer?: string) => Promise<string | null>;
	// setAssetSource: (assetReferenceId: string, source: string | Uint8Array) => void;

  warn: typeof console.warn;
	// warn: (warning: RollupWarning | string, pos?: number | { column: number; line: number }) => void;
}

export interface SourceMap {
	file: string;
	mappings: string;
	names: string[];
	sources: string[];
	sourcesContent: string[];
	version: number;
	toString(): string;
	toUrl(): string;
}
export interface TransformPluginContext extends PluginContext {
	getCombinedSourcemap: () => SourceMap;
}

export interface ExistingRawSourceMap {
	file?: string;
	mappings: string;
	names: string[];
	sourceRoot?: string;
	sources: string[];
	sourcesContent?: string[];
	version: number;
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

  const pluginContext: TransformPluginContext = {
    meta: {
      rollupVersion: '3.0.0',
      watchMode: true
    },
    addWatchFile: (id) => {},
    error: console.error,
    warn: console.warn,
    getCombinedSourcemap: () => {
      return {
        file: '',
        mappings: '',
        names: [],
        sources: [],
        sourcesContent: [],
        version: 3,
        toString: () => '',
        toUrl: () => ''
      }
    },
    resolve: async (source, importer, options) => {
      // 处理虚拟模块
      if (source.startsWith('\0')) {
        return createResolvedId(source)
      }

      // 处理绝对路径
      if (path.isAbsolute(source)) {
        const resolved = tryResolveRealFileOrType(source, DEFAULT_EXTENSIONS, false)
        if (resolved) {
          return createResolvedId(resolved)
        }
        return null
      }

      // 处理相对路径
      if (source.startsWith('.') && importer) {
        const importerDir = path.dirname(importer)
        const resolved = path.resolve(importerDir, source)
        const finalPath = tryResolveRealFileOrType(resolved, DEFAULT_EXTENSIONS, false)
        if (finalPath) {
          return createResolvedId(finalPath)
        }
        return null
      }

      // 处理bare imports（裸导入）
      if (bareImportRE.test(source)) {
        return resolveBareImport(source, importer, options)
      }

      return null
    },
  }

  /**
   * 解析bare import
   */
  async function resolveBareImport(
    id: string,
    importer?: string,
    options?: { custom?: any; isEntry?: boolean; skipSelf?: boolean }
  ): Promise<ResolvedId | null> {
    // 解析包名和子路径
    const match = deepImportRE.exec(id)
    const packageName = match ? match[1] || match[2] : id
    const subpath = match ? id.slice(packageName.length + 1) : ''

    // 查找node_modules中的包
    const packageDir = await findPackageDir(packageName, importer)
    if (!packageDir) {
      return null
    }

    // 如果有子路径，直接解析
    if (subpath) {
      const subpathResolved = path.resolve(packageDir, subpath)
      const finalPath = tryResolveRealFileOrType(subpathResolved, DEFAULT_EXTENSIONS, false)
      if (finalPath) {
        return createResolvedId(finalPath)
      }
      return null
    }

    // 解析包入口点
    const packageData = findNearestPackageData(packageDir)
    if (!packageData) {
      return null
    }

    const entryPath = resolvePackageEntry(
      id,
      packageData,
      packageDir,
      DEFAULT_EXTENSIONS,
      false
    )

    if (entryPath) {
      return createResolvedId(entryPath)
    }

    return null
  }

  /**
   * 查找包目录
   */
  async function findPackageDir(packageName: string, importer?: string): Promise<string | null> {
    // 从importer开始向上查找node_modules
    let searchDir = importer ? path.dirname(importer) : process.cwd()

    while (searchDir !== path.dirname(searchDir)) {
      const nodeModulesDir = path.join(searchDir, 'node_modules')
      const packageDir = path.join(nodeModulesDir, packageName)

      if (isDirectory(packageDir)) {
        return packageDir
      }

      searchDir = path.dirname(searchDir)
    }

    // 最后尝试全局node_modules
    const globalNodeModules = path.join(process.cwd(), 'node_modules', packageName)
    if (isDirectory(globalNodeModules)) {
      return globalNodeModules
    }

    return null
  }

  return {
    name: 'bun:vue2',
    setup(build) {

      // const transpiler = new Bun.Transpiler();

		  // let trackedImports: Record<string, number> = {};

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

      // build.onResolve({ filter: /\.vue$/ }, ({ path: id }) => {
      //   return { path: id, namespace: 'vue-sfc' }
      // });

      build.onResolve({
        filter: /.*/
        // filter: /\.vue/
      }, ({ path: id, importer }) => {
        console.log('resolveId: ', id)

        // component export helper
        if (id === NORMALIZER_ID) {
          console.log('NORMALIZER_ID', NORMALIZER_MODULE_ID)
          return { path: NORMALIZER_ID, namespace: 'vue-sfc-helper' }
        }
        if (id === HMR_RUNTIME_ID) {
          console.log('[HMR] HMR_RUNTIME_ID', HMR_RUNTIME_MODULE_ID)
          return { path: HMR_RUNTIME_ID, namespace: 'vue-sfc-helper' }
        }
        // serve sub-part requests (*?vue) as virtual modules
        // if (parseVueRequest(id).query.vue) {
        if (/\.vue/.test(id)) {
          // 将相对路径解析为绝对路径
          let resolvedPath = id
          if (!path.isAbsolute(id)) {
            if (importer) {
              const importerPath = importer.includes('?') ? importer.split('?')[0] : importer
              const absoluteImporter = path.isAbsolute(importerPath)
                ? importerPath
                : path.resolve(options.root, importerPath)
              const importerDir = path.dirname(absoluteImporter)
              resolvedPath = path.resolve(importerDir, id)
            } else {
              resolvedPath = path.resolve(options.root, id)
            }
          }
          return { path: resolvedPath, namespace: 'vue-sfc' }
        }

        // 处理别名 @ -> playground 或 root
        if (id.startsWith('@/') && importer) {
          const resolved = path.resolve(options.root, id.slice(2))
          console.log('resolveId: alias @/ ->', resolved)
          return { path: resolved, external: false }
        }

        // 处理相对路径的静态资源
        if (id.startsWith('./') || id.startsWith('../')) {
          if (importer) {
            const importerPath = importer.includes('?') ? importer.split('?')[0] : importer
            // 如果 importer 本身是相对路径，先解析为绝对路径
            const absoluteImporter = path.isAbsolute(importerPath)
              ? importerPath
              : path.resolve(options.root, importerPath)
            const importerDir = path.dirname(absoluteImporter)
            const resolved = path.resolve(importerDir, id)
            console.log('resolveId: relative path ->', resolved, 'from', importerDir)

            // 检查文件是否存在
            if (isFileReadable(resolved)) {
              return { path: resolved, external: false }
            }
          }
        }

        // 处理绝对路径
        if (id.startsWith('/') && !id.startsWith('//')) {
          // 优先检查 public 目录
          const publicPath = path.join(options.root, 'public', id)
          if (isFileReadable(publicPath)) {
            console.log('resolveId: absolute path (public) ->', publicPath)
            return { path: publicPath, external: false }
          }

          // 其次检查 root 目录
          const resolved = path.join(options.root, id)
          console.log('resolveId: absolute path ->', resolved)
          if (isFileReadable(resolved)) {
            return { path: resolved, external: false }
          }
        }

        return undefined
      });

      build.onLoad({ filter: /.*/, namespace: 'vue-sfc-helper' }, ({ path: id }) => {
        if (id === NORMALIZER_ID) {
          return { contents: normalizerCode }
        }
        if (id === HMR_RUNTIME_ID) {
          return { contents: hmrRuntimeCode }
        }
      });

      // ==================== resolveId end ======================

      build.onLoad({ filter: /.*/,namespace: 'vue-sfc'}, async ({ path }) => {
        console.log('onLoad', path)
        const ssr = false
        const { filename, query } = parseVueRequest(path)
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
          // return transformMain(code, filename, options, this, ssr)
          const rawCode = await Bun.file(path).text();
          const transformed = await transformMain(rawCode, filename, options, pluginContext, ssr);
          // console.log('transformed', transformed?.code)
          await Bun.write(filename+'.js', transformed?.code || rawCode);
          return { contents: transformed?.code || rawCode }
        }
        else {
          console.log('query.type => ',  query)
          // sub block request
          const descriptor = query.src
            ? getSrcDescriptor(filename, query)!
            : getDescriptor(filename, options)!

          if (query.src) {
            // return fs.readFileSync(filename, 'utf-8')
            return { contents: await Bun.file(filename).text() }
          }

          let block: SFCBlock | null | undefined
          if (query.type === 'script') {
            // handle <scrip> + <script setup> merge via compileScript()
            block = getResolvedScript(descriptor, ssr)
            if (block){
              // console.log(`[script block] returning block.content`, block.content)
              return { contents: block.content }
            }
          }
          else if (query.type === 'template') {
            block = descriptor.template!
            if (block) {
              // console.log(`[template block] returning block.content`, block.content)
              const transformed = await transformTemplateAsModule(
                block.content,
                descriptor,
                options,
                pluginContext,
                ssr
              )

              // console.log('[template] transformed', transformed)

              return {
                contents: transformed
              }
            }

          }
          else if (query.type === 'style') {
            block = descriptor.styles[query.index!]
            if (block) {
              // console.log(`[style block] returning block.content`, block.content)
              const transformed = await transformStyle(
                block.content,
                descriptor,
                Number(query.index),
                options,
                pluginContext,
                filename
              )

              // console.log('[style] transformed', transformed)

              return {
                contents: transformed?.code || ''
              }
            }

          }
          else if (query.index != null) {
            block = descriptor.customBlocks[query.index]
            if (block) {
              // console.log(`[custom block] returning block.content`, block.content)
              return { contents: block.content }
            }
          }
        }
      });

    }
  }

}
