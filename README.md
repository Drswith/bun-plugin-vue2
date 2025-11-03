# bun-plugin-vue2

English | [简体中文](./README.zh-CN.md)

A Vue 2.7 Single File Component (SFC) plugin for Bun, ported from [@vitejs/plugin-vue2](https://github.com/vitejs/vite-plugin-vue2).

## Introduction

`bun-plugin-vue2` enables you to use Vue 2.7 Single File Components (.vue files) directly in Bun environment without additional build tools. The plugin supports all Vue 2.7 features, including `<script setup>` syntax sugar.

## Features

- ✅ Vue 2.7 Single File Components support
- ✅ `<script setup>` syntax support
- ✅ Scoped CSS and CSS Modules support
- ✅ Static asset references in templates
- ✅ Custom blocks support
- ✅ HMR (Hot Module Replacement) support
- ✅ Async components support
- ✅ External file imports via `src` attribute

## Installation

```bash
bun install bun-plugin-vue2 -D
```

## Usage

### Basic Usage

Use the plugin in your Bun build script:

```typescript
import vue from 'bun-plugin-vue2'

await Bun.build({
  entrypoints: ['./main.js'],
  outdir: './dist',
  plugins: [vue()]
})
```

### Configuration Options

```typescript
vue({
  // File pattern to include, defaults to /\.vue$/
  include: /\.vue$/,

  // File pattern to exclude
  exclude: undefined,

  // Whether it's production environment
  isProduction: process.env.NODE_ENV === 'production',

  // Vue compiler options
  template: {
    compilerOptions: {},
    transformAssetUrls: {}
  },

  // Script options
  script: {
    babelParserPlugins: []
  },

  // Style options
  style: {
    trim: true
  }
})
```

## Development

```bash
# Install dependencies
bun install

# Development mode (hot reload)
bun dev

# Build playground
bun run build:playground

# Run tests
bun test
```

## Playground Example

The project includes a complete example application (playground directory) ported from [@vitejs/plugin-vue2](https://github.com/vitejs/vite-plugin-vue2), demonstrating various plugin features:

- CSS features: Scoped CSS, CSS Modules, CSS v-bind
- Components: Recursive components, Async components
- `<script setup>` syntax
- Static asset references
- Custom blocks
- HMR hot reload

## Tech Stack

- **Runtime**: Bun
- **Language**: TypeScript
- **Framework**: Vue 2.7
- **Module Standard**: ES2020

## Contributing

Contributions are welcome! If you find a bug or have a feature suggestion:

1. Fork this repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Ensure code follows TypeScript conventions
- Keep debug logs for troubleshooting
- Add test cases for new features
- Verify functionality works in playground

## Contact

For questions or suggestions, feel free to reach out:

- Submit an [Issue](https://github.com/Drswith/bun-plugin-vue2/issues)
- Start a [Discussion](https://github.com/Drswith/bun-plugin-vue2/discussions)

## License

[MIT](./LICENSE)

## Known Issues

Due to unknown reasons, while this plugin works properly in build mode, it currently cannot be used with Bun v1.3's new features [Fullstack dev server](https://bun.com/docs/bundler/fullstack) and [Hot reloading](https://bun.com/docs/bundler/hot-reloading)
