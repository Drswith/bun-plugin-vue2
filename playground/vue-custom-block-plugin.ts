import type { BunPlugin } from 'bun'
import { parseVueRequest } from '../src/utils/query'
import { getDescriptor } from '../src/utils/descriptorCache'

/**
 * Vue 自定义块处理插件（独立于主 Vue 插件）
 * 参考 Vite 插件实现，处理 Vue SFC 中的自定义块（如 <custom> 块）
 *
 * 工作原理：
 * 1. 拦截带有 type=custom 查询参数的请求
 * 2. 将自定义块内容转换为导出函数的形式
 * 3. 通过 Object.assign 将自定义块数据注入到组件实例的 __customBlock 属性中
 */
export default function vueCustomBlockPlugin(): BunPlugin {
  return {
    name: 'vue-custom-block-plugin',
    setup(build) {
      console.log('[vue-custom-block-plugin] 插件已加载')

      /**
       * 处理自定义块请求
       * 匹配带有 type=custom 参数的请求
       * 注意：必须在主 Vue 插件之后注册，才能接收到主插件跳过的请求
       */
      build.onLoad({ filter: /.*/, namespace: 'vue-sfc' }, async ({ path }) => {
        // 只处理自定义块请求
        if (!/type=custom/i.test(path)) {
          return undefined
        }

        console.log('[vue-custom-block-plugin] 处理自定义块:', path)

        // 解析 Vue 请求路径
        const { filename, query } = parseVueRequest(path)

        if (!query.vue || query.type !== 'custom') {
          console.log('[vue-custom-block-plugin] 非自定义块请求，跳过')
          return undefined
        }

        // 获取 SFC 描述符
        // 注意：这里依赖主 Vue 插件已经解析并缓存了 descriptor
        const descriptor = getDescriptor(filename, {
          compiler: null as any, // 自定义块不需要编译器
          root: process.cwd(),
          sourceMap: true,
          cssDevSourcemap: false,
          isProduction: process.env.NODE_ENV === 'production'
        }, false)

        if (!descriptor) {
          console.warn('[vue-custom-block-plugin] 未找到 descriptor:', filename)
          return undefined
        }

        // 获取对应索引的自定义块
        const block = descriptor.customBlocks[query.index!]
        if (!block) {
          console.warn('[vue-custom-block-plugin] 未找到自定义块，索引:', query.index)
          return undefined
        }

        console.log('[vue-custom-block-plugin] 自定义块内容:', block.content)
        console.log('[vue-custom-block-plugin] 自定义块类型:', block.type)
        console.log('[vue-custom-block-plugin] 自定义块属性:', block.attrs)
        console.log('[vue-custom-block-plugin] 自定义块 src:', block.src)

        let blockContent = block.content.trim()

        // 处理 src 引用：如果是外部文件引用，需要加载文件内容
        if (query.src && block.src) {
          console.log('[vue-custom-block-plugin] 处理 src 引用:', block.src)
          // src 引用的文件路径已经在 filename 中
          try {
            blockContent = await Bun.file(filename).text()
            console.log('[vue-custom-block-plugin] 加载的 src 内容:', blockContent)
          } catch (error) {
            console.error('[vue-custom-block-plugin] 加载 src 文件失败:', error)
            return undefined
          }
        }

        // 如果内容为空，跳过处理
        if (!blockContent) {
          console.warn('[vue-custom-block-plugin] 自定义块内容为空')
          return {
            contents: 'export default function (Comp) {}',
            loader: 'js'
          }
        }

        let transformedAssignment: string

        // 检查是否已经有 export default
        if (/export\s+default/.test(blockContent)) {
          // 将默认导出转换为变量赋值
          // 例如：export default { ... } => const __customBlock = { ... }
          transformedAssignment = blockContent.replace(/export\s+default/, 'const __customBlock =')
        } else {
          // 纯数据格式（如 JSON），直接包装为变量赋值
          transformedAssignment = `const __customBlock = ${blockContent}`
        }

        // 生成注入代码
        // 返回一个函数，该函数接收组件对象并将自定义块数据注入到 __customBlock 属性
        const code = `${transformedAssignment}
  export default function (Comp) {
    if (!Comp.__customBlock) {
      Comp.__customBlock = {};
    }
    Object.assign(Comp.__customBlock, __customBlock);
    console.log('[vue-custom-block-plugin] 已注入自定义块数据:', __customBlock);
  }`

        console.log('[vue-custom-block-plugin] 生成的代码:\n', code)

        return {
          contents: code,
          loader: 'js'
        }
      })
    }
  }
}

