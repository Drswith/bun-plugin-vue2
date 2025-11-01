/**
 * HMR工具函数
 *
 * 注意：在Bun环境下，不使用Vite特有的handleHotUpdate插件钩子。
 * Bun实现了与Vite兼容的import.meta.hot API，HMR逻辑直接在编译后的模块中生成。
 *
 * 本文件提供的工具函数用于：
 * 1. isEqualBlock - 比较SFC块是否相同
 * 2. isOnlyTemplateChanged - 检查是否只有模板变化（用于main.ts中决定是否只需要rerender）
 * 3. needsReload - 检查是否需要完整reload（script、scoped状态、自定义块变化）
 */
import type { SFCBlock, SFCDescriptor } from 'vue/compiler-sfc'
import { getResolvedScript } from './script'

/**
 * 比较两个SFC块是否相同
 * 用于判断哪些部分发生了变化
 */
export function isEqualBlock(a: SFCBlock | null, b: SFCBlock | null): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  // src imports will trigger their own updates
  if (a.src && b.src && a.src === b.src) return true
  if (a.content !== b.content) return false
  const keysA = Object.keys(a.attrs)
  const keysB = Object.keys(b.attrs)
  if (keysA.length !== keysB.length) {
    return false
  }
  return keysA.every((key) => a.attrs[key] === b.attrs[key])
}

/**
 * 检查是否只有模板发生了变化
 * 如果只有模板变化，可以只重新渲染而不需要完整reload
 * 这个函数在main.ts中用于决定设置_rerender_only标志
 */
export function isOnlyTemplateChanged(
  prev: SFCDescriptor,
  next: SFCDescriptor
): boolean {
  return (
    !hasScriptChanged(prev, next) &&
    prev.styles.length === next.styles.length &&
    prev.styles.every((s, i) => isEqualBlock(s, next.styles[i])) &&
    prev.customBlocks.length === next.customBlocks.length &&
    prev.customBlocks.every((s, i) => isEqualBlock(s, next.customBlocks[i]))
  )
}

/**
 * 检查script是否发生了变化
 */
function hasScriptChanged(prev: SFCDescriptor, next: SFCDescriptor): boolean {
  if (!isEqualBlock(prev.script, next.script)) {
    return true
  }
  if (!isEqualBlock(prev.scriptSetup, next.scriptSetup)) {
    return true
  }

  // vue core #3176
  // <script setup lang="ts"> prunes non-unused imports
  // the imports pruning depends on template, so script may need to re-compile
  // based on template changes
  const prevResolvedScript = getResolvedScript(prev, false)
  // this is only available in vue@^3.2.23
  const prevImports = prevResolvedScript?.imports
  if (prevImports) {
    return next.shouldForceReload(prevImports)
  }

  return false
}

/**
 * 检查是否需要完整reload（非template-only更新）
 * 用于Bun HMR：在main.ts中生成的HMR代码会调用此逻辑
 */
export function needsReload(
  prev: SFCDescriptor,
  next: SFCDescriptor
): boolean {
  // script变化需要reload
  if (hasScriptChanged(prev, next)) {
    return true
  }

  // scoped状态变化需要reload
  const prevScoped = prev.styles.some((s) => s.scoped)
  const nextScoped = next.styles.some((s) => s.scoped)
  if (prevScoped !== nextScoped) {
    return true
  }

  // style数量变化需要reload
  if (prev.styles.length !== next.styles.length) {
    return true
  }

  // 自定义块变化需要reload
  if (prev.customBlocks.length !== next.customBlocks.length) {
    return true
  }

  // 检查每个自定义块
  for (let i = 0; i < next.customBlocks.length; i++) {
    if (!isEqualBlock(prev.customBlocks[i], next.customBlocks[i])) {
      return true
    }
  }

  return false
}
