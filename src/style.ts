import type { RawSourceMap } from 'source-map';
import type { SFCDescriptor } from 'vue/compiler-sfc';
// import { formatPostcssSourceMap } from 'vite'
import type {
  ExistingRawSourceMap,
  ResolvedOptions,
  TransformPluginContext,
} from '.';
import { throwBunPluginError } from './utils/error';

function formatPostcssSourceMap(
  rawMap: ExistingRawSourceMap,
  file: string,
): Promise<ExistingRawSourceMap> {
  return new Promise((resolve) => {
    resolve(rawMap);
  });
}

export async function transformStyle(
  code: string,
  descriptor: SFCDescriptor,
  index: number,
  options: ResolvedOptions,
  pluginContext: TransformPluginContext,
  filename: string,
) {
  const block = descriptor.styles[index];
  // vite already handles pre-processors and CSS module so this is only
  // applying SFC-specific transforms like scoped mode and CSS vars rewrite (v-bind(var))
  const result = await options.compiler.compileStyleAsync({
    ...options.style,
    filename: descriptor.filename,
    id: `data-v-${descriptor.id}`,
    isProd: options.isProduction,
    source: code,
    scoped: !!block.scoped,
    ...(options.cssDevSourcemap
      ? {
          postcssOptions: {
            map: {
              from: filename,
              inline: false,
              annotation: false,
            },
          },
        }
      : {}),
  });

  if (result.errors.length) {
    // Bun插件错误处理：记录所有错误后抛出第一个
    if (result.errors.length > 1) {
      console.error(
        `[bun:vue2] Found ${result.errors.length} style errors in ${filename}:`,
      );
      result.errors.forEach((error, index) => {
        console.error(`  Error ${index + 1}:`, error);
      });
    }

    const firstError: any = result.errors[0];
    // 添加位置信息
    if (firstError.line && firstError.column) {
      const errorWithLoc = new Error(firstError.message || String(firstError));
      errorWithLoc.name = 'VueStyleError';
      (errorWithLoc as any).position = {
        file: descriptor.filename,
        line: firstError.line + getLine(descriptor.source, block.start),
        column: firstError.column,
      };
      console.error(
        `[bun:vue2] Style compilation error at ${descriptor.filename}:${(errorWithLoc as any).position.line}:${(errorWithLoc as any).position.column}`,
      );
      throw errorWithLoc;
    }

    // 如果没有位置信息，直接抛出
    if (firstError instanceof Error) {
      throwBunPluginError(filename, firstError);
    } else {
      throw new Error(
        `[bun:vue2] Style compilation error in ${filename}:\n  ${String(firstError)}`,
      );
    }
  }

  const map = result.map
    ? await formatPostcssSourceMap(
        // version property of result.map is declared as string
        // but actually it is a number
        result.map as Omit<RawSourceMap, 'version'> as ExistingRawSourceMap,
        filename,
      )
    : ({ mappings: '' } as any);

  return {
    code: result.code,
    map: map,
  };
}

function getLine(source: string, start: number) {
  const lines = source.split(/\r?\n/g);
  let cur = 0;
  for (let i = 0; i < lines.length; i++) {
    cur += lines[i].length;
    if (cur >= start) {
      return i;
    }
  }
}
