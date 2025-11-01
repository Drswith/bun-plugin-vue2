import { test, expect, describe } from 'bun:test'
import {
  createBunPluginError,
  formatBunError,
  throwBunPluginError,
  logBunWarning,
  type BunPluginError
} from '../src/utils/error'

describe('Error Handling', () => {
  describe('createBunPluginError', () => {
    test('应该正确处理Vue编译器错误（带位置信息）', () => {
      const vueCompilerError = {
        msg: 'Unexpected token',
        line: 10,
        column: 5
      }

      const result = createBunPluginError('/path/to/component.vue', vueCompilerError)

      expect(result.name).toBe('VueCompilerError')
      expect(result.message).toBe('Unexpected token')
      expect(result.position?.file).toBe('/path/to/component.vue')
      expect(result.position?.line).toBe(10)
      expect(result.position?.column).toBe(5)
    })

    test('应该正确处理标准Error对象', () => {
      const standardError = new Error('Something went wrong')
      standardError.name = 'TestError'
      standardError.stack = 'Error: Something went wrong\n  at test.js:10:5'

      const result = createBunPluginError('/path/to/file.vue', standardError)

      expect(result.name).toBe('TestError')
      expect(result.message).toBe('Something went wrong')
      expect(result.position?.file).toBe('/path/to/file.vue')
      expect(result.notes).toEqual(['Error: Something went wrong\n  at test.js:10:5'])
    })

    test('应该正确处理没有名称的Error对象', () => {
      const error = new Error('Test error')
      error.name = ''

      const result = createBunPluginError('/test.vue', error)

      expect(result.name).toBe('VuePluginError')
      expect(result.message).toBe('Test error')
    })
  })

  describe('formatBunError', () => {
    test('应该正确格式化完整的错误信息', () => {
      const error: BunPluginError = {
        name: 'VueCompilerError',
        message: 'Unexpected token',
        position: {
          file: '/path/to/component.vue',
          line: 10,
          column: 5
        },
        notes: ['Additional info']
      }

      const formatted = formatBunError(error)

      expect(formatted).toContain('[bun:vue2] VueCompilerError: Unexpected token')
      expect(formatted).toContain('/path/to/component.vue:10:5')
      expect(formatted).toContain('Additional info')
    })

    test('应该正确格式化没有位置信息的错误', () => {
      const error: BunPluginError = {
        name: 'TestError',
        message: 'Test message',
        position: {
          file: '/test.vue'
        }
      }

      const formatted = formatBunError(error)

      expect(formatted).toContain('[bun:vue2] TestError: Test message')
      expect(formatted).toContain('at /test.vue')
      // 不应该包含行号和列号（即文件路径后面没有:数字）
      expect(formatted).not.toMatch(/\/test\.vue:\d+/)
    })
  })

  describe('throwBunPluginError', () => {
    test('应该抛出格式化的错误', () => {
      const vueError = {
        msg: 'Syntax error',
        line: 5,
        column: 10
      }

      expect(() => {
        throwBunPluginError('/error.vue', vueError)
      }).toThrow()
    })

    test('抛出的错误应该包含bunPluginError属性', () => {
      const vueError = {
        msg: 'Test error',
        line: 1,
        column: 1
      }

      try {
        throwBunPluginError('/test.vue', vueError)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as any).bunPluginError).toBeDefined()
        expect((error as any).bunPluginError.name).toBe('VueCompilerError')
        expect((error as any).bunPluginError.message).toBe('Test error')
      }
    })

    test('抛出的错误名称应该正确设置', () => {
      const vueError = {
        msg: 'Test error'
      }

      try {
        throwBunPluginError('/test.vue', vueError)
      } catch (error) {
        expect((error as Error).name).toBe('VueCompilerError')
      }
    })
  })

  describe('logBunWarning', () => {
    test('应该能处理字符串警告', () => {
      // 这个测试只验证函数不会抛出错误
      expect(() => {
        logBunWarning('/test.vue', 'This is a warning')
      }).not.toThrow()
    })

    test('应该能处理WarningMessage对象', () => {
      const warning = {
        msg: 'Vue compiler warning'
      }

      expect(() => {
        logBunWarning('/test.vue', warning as any)
      }).not.toThrow()
    })
  })

  describe('多错误场景', () => {
    test('应该能处理多个错误', () => {
      const errors = [
        { msg: 'Error 1', line: 1, column: 1 },
        { msg: 'Error 2', line: 2, column: 1 },
        { msg: 'Error 3', line: 3, column: 1 }
      ]

      const filename = '/multi-error.vue'

      // 验证所有错误都能被正确处理
      errors.forEach(error => {
        const bunError = createBunPluginError(filename, error)
        expect(bunError.name).toBe('VueCompilerError')
        expect(bunError.position?.file).toBe(filename)
      })
    })
  })
})
