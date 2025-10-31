import fs from 'node:fs'
import path from 'node:path'
import type { ResolvedId } from '../index'

// 常量定义
export const DEFAULT_EXTENSIONS = ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json']
export const DEFAULT_MAIN_FIELDS = ['module', 'jsnext:main', 'jsnext', 'main']

// 正则表达式
export const bareImportRE = /^(?![a-zA-Z]:)[\w@](?!.*:\/\/)/
export const deepImportRE = /^([^@][^/]*)\/|^(@[^/]+\/[^/]+)\//
export const isWindows = process.platform === 'win32'

/**
 * 规范化路径，统一使用正斜杠
 */
export function normalizePath(id: string): string {
  return path.posix.normalize(isWindows ? id.replace(/\\/g, '/') : id)
}

/**
 * 尝试同步获取文件状态
 */
export function tryStatSync(file: string): fs.Stats | undefined {
  try {
    return fs.statSync(file, { throwIfNoEntry: false })
  } catch {
    return undefined
  }
}

/**
 * 检查文件是否存在且可读
 */
export function isFileReadable(filename: string): boolean {
  const stat = tryStatSync(filename)
  if (!stat) return false
  
  try {
    fs.accessSync(filename, fs.constants.R_OK)
    return true
  } catch {
    return false
  }
}

/**
 * 检查是否为目录
 */
export function isDirectory(path: string): boolean {
  const stat = tryStatSync(path)
  return stat?.isDirectory() ?? false
}

/**
 * 尝试解析真实文件路径
 */
export function tryResolveRealFile(
  file: string,
  preserveSymlinks?: boolean
): string | undefined {
  const stat = tryStatSync(file)
  if (stat?.isFile()) {
    return preserveSymlinks ? file : fs.realpathSync(file)
  }
}

/**
 * 尝试解析带扩展名的文件
 */
export function tryResolveRealFileWithExtensions(
  filePath: string,
  extensions: string[],
  preserveSymlinks?: boolean
): string | undefined {
  for (const ext of extensions) {
    const res = tryResolveRealFile(filePath + ext, preserveSymlinks)
    if (res) return res
  }
}

/**
 * 尝试解析文件或类型文件
 */
export function tryResolveRealFileOrType(
  file: string,
  extensions: string[],
  preserveSymlinks?: boolean
): string | undefined {
  // 首先尝试原始文件
  const withoutExt = tryResolveRealFile(file, preserveSymlinks)
  if (withoutExt) return withoutExt
  
  // 然后尝试添加扩展名
  return tryResolveRealFileWithExtensions(file, extensions, preserveSymlinks)
}

/**
 * 检查是否在node_modules中
 */
export function isInNodeModules(id: string): boolean {
  return id.includes('node_modules')
}

/**
 * 解析package.json
 */
export function loadPackageData(pkgPath: string): any {
  try {
    const data = fs.readFileSync(pkgPath, 'utf-8')
    return JSON.parse(data)
  } catch {
    return null
  }
}

/**
 * 查找最近的package.json
 */
export function findNearestPackageData(dir: string): { data: any; dir: string } | null {
  let current = dir
  
  while (current !== path.dirname(current)) {
    const pkgPath = path.join(current, 'package.json')
    const data = loadPackageData(pkgPath)
    if (data) {
      return { data, dir: current }
    }
    current = path.dirname(current)
  }
  
  return null
}

/**
 * 解析包入口点
 */
export function resolvePackageEntry(
  id: string,
  packageData: any,
  dir: string,
  extensions: string[],
  preserveSymlinks?: boolean
): string | undefined {
  const { data } = packageData
  
  // 尝试exports字段
  if (data.exports) {
    // 简化的exports处理，只处理"."入口
    const exports = data.exports
    if (typeof exports === 'string') {
      const resolved = path.resolve(dir, exports)
      return tryResolveRealFileOrType(resolved, extensions, preserveSymlinks)
    } else if (exports['.']) {
      const entry = exports['.']
      const entryPath = typeof entry === 'string' ? entry : entry.import || entry.default
      if (entryPath) {
        const resolved = path.resolve(dir, entryPath)
        return tryResolveRealFileOrType(resolved, extensions, preserveSymlinks)
      }
    }
  }
  
  // 尝试main字段
  for (const field of DEFAULT_MAIN_FIELDS) {
    if (data[field]) {
      const resolved = path.resolve(dir, data[field])
      const result = tryResolveRealFileOrType(resolved, extensions, preserveSymlinks)
      if (result) return result
    }
  }
  
  // 尝试默认入口
  const defaultEntries = ['index.js', 'index.json', 'index.node']
  for (const entry of defaultEntries) {
    const resolved = path.resolve(dir, entry)
    const result = tryResolveRealFile(resolved, preserveSymlinks)
    if (result) return result
  }
  
  return undefined
}

/**
 * 创建ResolvedId对象
 */
export function createResolvedId(
  id: string,
  external: boolean | 'absolute' = false,
  meta: any = {},
  moduleSideEffects: boolean = true,
  syntheticNamedExports: boolean | string = false
): ResolvedId {
  return {
    id: normalizePath(id),
    external,
    meta,
    moduleSideEffects,
    syntheticNamedExports
  }
}