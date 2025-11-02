import path from 'node:path';
import hash from 'hash-sum';
import slash from 'slash';
import type {
  SFCDescriptor,
  SFCTemplateCompileOptions,
} from 'vue/compiler-sfc';
import type { PluginContext, ResolvedOptions, TransformPluginContext } from '.';
import { getResolvedScript } from './script';
import { logBunWarning, throwBunPluginError } from './utils/error';
import { HMR_RUNTIME_ID } from './utils/hmrRuntime';

export async function transformTemplateAsModule(
  code: string,
  descriptor: SFCDescriptor,
  options: ResolvedOptions,
  pluginContext: TransformPluginContext,
  ssr: boolean,
): Promise<string> {
  let returnCode = compile(code, descriptor, options, pluginContext, ssr);
  if (
    options.devServer &&
    options.devServer.config.server.hmr !== false &&
    !ssr &&
    !options.isProduction
  ) {
    returnCode += `\nimport __VUE_HMR_RUNTIME__ from "${HMR_RUNTIME_ID}"`;
    returnCode += `\nimport.meta.hot.accept((updated) => {
      __VUE_HMR_RUNTIME__.rerender(${JSON.stringify(descriptor.id)}, updated)
    })`;
  }

  return returnCode + `\nexport { render, staticRenderFns }`;
}

/**
 * transform the template directly in the main SFC module
 */
export function transformTemplateInMain(
  code: string,
  descriptor: SFCDescriptor,
  options: ResolvedOptions,
  pluginContext: PluginContext,
  ssr: boolean,
): string {
  return compile(code, descriptor, options, pluginContext, ssr)
    .replace(/var (render|staticRenderFns) =/g, 'var _sfc_$1 =')
    .replace(/(render._withStripped)/, '_sfc_$1');
}

export function compile(
  code: string,
  descriptor: SFCDescriptor,
  options: ResolvedOptions,
  pluginContext: PluginContext,
  ssr: boolean,
): string {
  const filename = descriptor.filename;
  const result = options.compiler.compileTemplate({
    ...resolveTemplateCompilerOptions(descriptor, options, ssr)!,
    source: code,
  });

  if (result.errors.length) {
    // Bun插件错误处理：记录所有错误后抛出第一个
    if (result.errors.length > 1) {
      console.error(
        `[bun:vue2] Found ${result.errors.length} template errors in ${filename}:`,
      );
      result.errors.forEach((error, index) => {
        console.error(`  Error ${index + 1}:`, error);
      });
    }

    const firstError = result.errors[0];
    if (typeof firstError === 'string') {
      throw new Error(
        `[bun:vue2] Template compilation error in ${filename}:\n  ${firstError}`,
      );
    } else {
      throwBunPluginError(filename, firstError);
    }
  }

  if (result.tips.length) {
    // Bun中使用console.warn输出警告
    result.tips.forEach((tip) => {
      const message = typeof tip === 'string' ? tip : tip.msg;
      logBunWarning(filename, message);
    });
  }

  return transformRequireToImport(result.code);
}

function resolveTemplateCompilerOptions(
  descriptor: SFCDescriptor,
  options: ResolvedOptions,
  ssr: boolean,
): Omit<SFCTemplateCompileOptions, 'source'> | undefined {
  const block = descriptor.template;
  if (!block) {
    return;
  }
  const resolvedScript = getResolvedScript(descriptor, ssr);
  const hasScoped = descriptor.styles.some((s) => s.scoped);
  const { id, filename } = descriptor;

  let preprocessOptions = block.lang && options.template?.preprocessOptions;
  if (block.lang === 'pug') {
    preprocessOptions = {
      doctype: 'html',
      ...preprocessOptions,
    };
  }

  const transformAssetUrls = options.template?.transformAssetUrls ?? true;
  let assetUrlOptions: any;
  if (options.devServer) {
    // during dev, inject vite base so that compiler-sfc can transform
    // relative paths directly to absolute paths without incurring an extra import
    // request
    if (filename.startsWith(options.root)) {
      assetUrlOptions = {
        base:
          (options.devServer.config.server?.origin ?? '') +
          options.devServer.config.base +
          slash(path.relative(options.root, path.dirname(filename))),
      };
    }
  } else if (transformAssetUrls !== false) {
    // build: force all asset urls into import requests so that they go through
    // the assets plugin for asset registration
    assetUrlOptions = {
      includeAbsolute: true,
    };
  }

  return {
    transformAssetUrls,
    ...options.template,
    filename,
    isProduction: options.isProduction,
    isFunctional: !!block.attrs.functional,
    optimizeSSR: ssr,
    transformAssetUrlsOptions: {
      ...assetUrlOptions,
      ...options.template?.transformAssetUrlsOptions,
    },
    preprocessLang: block.lang,
    preprocessOptions,
    bindings: resolvedScript ? resolvedScript.bindings : undefined,
    prettify: false,
    compilerOptions: {
      whitespace: 'condense',
      outputSourceRange: true,
      ...options.template?.compilerOptions,
      scopeId: hasScoped ? `data-v-${id}` : undefined,
    },
  };
}

function transformRequireToImport(code: string): string {
  const imports: Record<string, string> = {};
  let strImports = '';

  code = code.replace(
    /require\(("(?:[^"\\]|\\.)+"|'(?:[^'\\]|\\.)+')\)/g,
    (_, name): any => {
      if (!(name in imports)) {
        // #81 compat unicode assets name
        imports[name] = `__$_require_${hash(name)}__`;
        strImports += `import ${imports[name]} from ${name}\n`;
      }

      return imports[name];
    },
  );

  return strImports + code;
}
