
import { isAbsolute, resolve } from 'node:path';
import { Glob } from 'bun';

export type FilterPattern = ReadonlyArray<string | RegExp> | string | RegExp | null;

interface CreateFilterOptions {
    resolve?: string | false | null | undefined;
}

/**
 * 确保返回数组
 */
function ensureArray<T>(thing: T | readonly T[] | null | undefined): readonly T[] {
    if (Array.isArray(thing)) return thing as readonly T[];
    if (thing == null) return [];
    return [thing as T];
}

/**
 * 获取用于匹配的路径字符串
 */
function getMatcherString(id: string, resolvePath: string | false | null | undefined): string {
    if (resolvePath === false || !resolvePath) {
        return id;
    }
    return isAbsolute(id) ? id : resolve(resolvePath, id);
}

/**
 * 创建匹配器函数
 */
function createMatcher(patterns: FilterPattern, resolvePath?: string | false | null): (id: string) => boolean {
    const matchers = ensureArray(patterns).map(pattern => {
        if (pattern instanceof RegExp) {
            return (id: string) => pattern.test(id);
        }
        if (typeof pattern === 'string') {
            // 使用 Bun 内置的 Glob 功能来匹配模式
            const glob = new Glob(pattern);
            return (id: string) => {
                const testPath = resolvePath ? getMatcherString(id, resolvePath) : id;
                return glob.match(testPath);
            };
        }
        throw new Error('Invalid pattern type');
    });

    return (id: string) => matchers.some(matcher => matcher(id));
}

/**
 * 创建一个过滤函数，用于确定是否应该处理某个模块
 * 与 @rollup/pluginutils 的 createFilter 行为完全一致
 *
 * 行为规则：
 * 1. 如果 options.include 被省略或长度为零，filter 默认返回 true
 * 2. 否则，ID 必须匹配一个或多个 include 模式
 * 3. 如果 options.exclude 被指定，ID 不能匹配任何 exclude 模式
 * 4. 包含 null 字符 (\0) 的 ID 总是返回 false
 * 5. 非字符串的 ID 总是返回 false
 *
 * @param include - 包含的模式（字符串、正则表达式或数组）
 * @param exclude - 排除的模式（字符串、正则表达式或数组）
 * @param options - 选项对象，可以包含 resolve 选项用于解析相对路径
 * @returns 过滤函数，接受 id 参数并返回 boolean
 */
export function createFilter(
    include?: FilterPattern | undefined,
    exclude?: FilterPattern | undefined,
    options?: CreateFilterOptions | undefined
): (id: string | unknown) => boolean {
    const resolvePath = options?.resolve;
    const includeMatchers = include ? ensureArray(include) : null;
    const excludeMatchers = exclude ? ensureArray(exclude) : null;

    return function filter(id: string | unknown): boolean {
        // 非字符串类型的 ID 直接返回 false
        if (typeof id !== 'string') return false;

        // 包含 null 字符的 ID 直接返回 false
        if (/\0/.test(id)) return false;

        const normalizedId = resolvePath ? getMatcherString(id, resolvePath) : id;

        // 如果有 exclude 规则且匹配，则排除
        if (excludeMatchers && excludeMatchers.length > 0) {
            const excludeMatcher = createMatcher(excludeMatchers, resolvePath);
            if (excludeMatcher(normalizedId)) return false;
        }

        // 如果没有 include 规则或 include 规则为空，则默认包含（除非被 exclude 排除）
        if (!includeMatchers || includeMatchers.length === 0) return true;

        // 如果有 include 规则，则必须匹配才包含
        const includeMatcher = createMatcher(includeMatchers, resolvePath);
        return includeMatcher(normalizedId);
    };
}
