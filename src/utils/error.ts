import type { WarningMessage } from 'vue/compiler-sfc'

/**
 * Bun插件错误信息接口
 * 参考: https://bun.sh/docs/bundler#logs-and-errors
 */
export interface BunPluginError {
  name: string
  message: string
  position?: {
    file: string
    line?: number
    column?: number
  }
  notes?: string[]
}

/**
 * 创建符合Bun.js规范的错误对象
 * 用于Vue编译器错误
 */
export function createBunPluginError(
  filename: string,
  error: Error | WarningMessage
): BunPluginError {
  if ('msg' in error) {
    // Vue编译器的WarningMessage格式
    const bunError: BunPluginError = {
      name: 'VueCompilerError',
      message: error.msg,
      position: {
        file: filename
      }
    }

    // 如果有位置信息，添加到错误对象中
    if ('line' in error && typeof error.line === 'number') {
      bunError.position!.line = error.line
    }
    if ('column' in error && typeof error.column === 'number') {
      bunError.position!.column = error.column
    }

    return bunError
  } else {
    // 标准Error对象
    const bunError: BunPluginError = {
      name: error.name || 'VuePluginError',
      message: error.message,
      position: {
        file: filename
      }
    }

    // 如果有stack信息，添加为notes
    if (error.stack) {
      bunError.notes = [error.stack]
    }

    return bunError
  }
}

/**
 * 格式化错误信息用于控制台输出
 * Bun会自动美化错误对象，但我们也可以提供自定义格式
 */
export function formatBunError(error: BunPluginError): string {
  let output = `\n[bun:vue2] ${error.name}: ${error.message}`

  if (error.position) {
    output += `\n  at ${error.position.file}`
    if (error.position.line !== undefined) {
      output += `:${error.position.line}`
      if (error.position.column !== undefined) {
        output += `:${error.position.column}`
      }
    }
  }

  if (error.notes && error.notes.length > 0) {
    output += `\n\nNotes:\n`
    error.notes.forEach(note => {
      output += `  ${note}\n`
    })
  }

  return output
}

/**
 * 抛出Bun插件错误
 * 在Bun插件中，应该直接抛出错误让Bun运行时处理
 */
export function throwBunPluginError(
  filename: string,
  error: Error | WarningMessage
): never {
  const bunError = createBunPluginError(filename, error)
  const formattedError = new Error(formatBunError(bunError))
  formattedError.name = bunError.name

  // 保留原始错误信息供调试
  ;(formattedError as any).bunPluginError = bunError

  throw formattedError
}

/**
 * 记录警告信息
 * 在Bun中使用console.warn输出警告
 */
export function logBunWarning(
  filename: string,
  warning: string | WarningMessage
): void {
  const message = typeof warning === 'string' ? warning : warning.msg
  console.warn(`[bun:vue2] Warning in ${filename}:\n  ${message}`)
}

// 向后兼容的别名（逐步迁移用）
/**
 * @deprecated 使用 createBunPluginError 代替
 */
export const createRollupError = createBunPluginError
