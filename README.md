# bun-plugin-vue2

一个用于 Bun 的 Vue 2.7 单文件组件（SFC）插件。

## 简介

`bun-plugin-vue2` 允许你在 Bun 环境中直接使用 Vue 2.7 单文件组件（.vue 文件），无需额外的构建工具。该插件支持 Vue 2.7 的所有特性，包括 `<script setup>` 语法糖。

## 特性

- ✅ 支持 Vue 2.7 单文件组件
- ✅ 支持 `<script setup>` 语法
- ✅ 支持 Scoped CSS 和 CSS Modules
- ✅ 支持模板中的静态资源引用
- ✅ 支持自定义块
- ✅ 支持 HMR（热模块替换）
- ✅ 支持异步组件
- ✅ 支持 `src` 属性导入外部文件

## 安装

```bash
bun install bun-plugin-vue2 -D
```

## 使用

### 基本用法

在你的 Bun 构建脚本中使用该插件：

```typescript
import vue from 'bun-plugin-vue2'

await Bun.build({
  entrypoints: ['./main.js'],
  outdir: './dist',
  plugins: [vue()]
})
```

### 配置选项

```typescript
vue({
  // 包含的文件模式，默认为 /\.vue$/
  include: /\.vue$/,

  // 排除的文件模式
  exclude: undefined,

  // 是否为生产环境
  isProduction: process.env.NODE_ENV === 'production',

  // Vue 编译器选项
  template: {
    compilerOptions: {},
    transformAssetUrls: {}
  },

  // 脚本选项
  script: {
    babelParserPlugins: []
  },

  // 样式选项
  style: {
    trim: true
  }
})
```

## 开发

```bash
# 安装依赖
bun install

# 开发模式（热重载）
bun dev

# 构建 playground
bun run build:playground

# 运行测试
bun test
```

## Playground Example

项目包含一个移植自[@vitejs/plugin-vue2](https://github.com/vitejs/vite-plugin-vue2)完整的示例应用（playground目录），展示了插件的各种功能：

- CSS 相关：Scoped CSS、CSS Modules、CSS v-bind
- 组件：递归组件、异步组件
- `<script setup>` 语法
- 静态资源引用
- 自定义块
- HMR 热更新

## 技术栈

- **运行时**: Bun
- **语言**: TypeScript
- **框架**: Vue 2.7
- **模块规范**: ES2020

## 贡献

欢迎贡献代码！如果你发现了 bug 或有新功能建议，请：

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的改动 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

### 开发指南

- 确保代码符合 TypeScript 规范
- 保留调试日志，便于问题排查
- 为新功能添加相应的测试用例
- 在 playground 中验证功能正常工作

## 联系方式

如有问题或建议，欢迎通过以下方式联系：

- 提交 [Issue](https://github.com/Drswith/bun-plugin-vue2/issues)
- 发起 [Discussion](https://github.com/Drswith/bun-plugin-vue2/discussions)

## 许可证

[MIT](./LICENSE)

## 注意事项

因为未知原因，虽然本插件实现了构建模式正常工作，但是目前无法在Bun v1.3提供的新特性[Fullstack dev server](https://bun.com/docs/bundler/fullstack)和[Hot reloading](https://bun.com/docs/bundler/hot-reloading)中使用
