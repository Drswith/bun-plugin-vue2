import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { RawSourceMap } from 'source-map'
import type { ResolvedOptions } from '.'

// Mock plugin context interface for Bun environment
interface PluginContext {
  error(err: any): void
  warn(warning: any): void
}

export async function transformStyle(
  code: string,
  descriptor: SFCDescriptor,
  index: number,
  options: ResolvedOptions,
  pluginContext: PluginContext,
  filename: string
) {
  const block = descriptor.styles[index]
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
              annotation: false
            }
          }
        }
      : {})
  })

  if (result.errors.length) {
    result.errors.forEach((error: any) => {
      if (error.line && error.column) {
        error.loc = {
          file: descriptor.filename,
          line: error.line + getLine(descriptor.source, block.start),
          column: error.column
        }
      }
      pluginContext.error(error)
    })
    return null
  }

  // Simple source map handling for Bun environment
  const map = result.map
    ? formatSourceMap(result.map as RawSourceMap, filename)
    : ({ mappings: '' } as any)

  return {
    code: result.code,
    map: map
  }
}

function getLine(source: string, start: number) {
  const lines = source.split(/\r?\n/g)
  let cur = 0
  for (let i = 0; i < lines.length; i++) {
    cur += lines[i].length
    if (cur >= start) {
      return i
    }
  }
  return 0
}

// Simple source map formatter for Bun environment
function formatSourceMap(map: RawSourceMap, filename: string): RawSourceMap {
  return {
    ...map,
    file: filename,
    sources: map.sources?.map(source => 
      source.startsWith('/') ? source : filename
    ) || [filename]
  }
}
