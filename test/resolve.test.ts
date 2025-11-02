import { expect, test } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import vuePlugin from '../src/index';

// 创建测试用的临时文件
const testDir = path.join(process.cwd(), 'test-temp');
const testFile = path.join(testDir, 'test.js');
const testVueFile = path.join(testDir, 'Test.vue');

// 设置测试环境
function setupTestFiles() {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }

  // 创建测试JS文件
  fs.writeFileSync(testFile, 'export default {}');

  // 创建测试Vue文件
  fs.writeFileSync(
    testVueFile,
    `
<template>
  <div>Test</div>
</template>
<script>
export default {
  name: 'Test'
}
</script>
`,
  );
}

// 清理测试环境
function cleanupTestFiles() {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}

test('resolve function - absolute path', async () => {
  setupTestFiles();

  try {
    // 直接测试resolve工具函数
    const { tryResolveRealFileOrType, createResolvedId, DEFAULT_EXTENSIONS } =
      await import('../src/utils/resolve');

    // 测试绝对路径解析
    const resolved = tryResolveRealFileOrType(
      testFile,
      DEFAULT_EXTENSIONS,
      false,
    );
    expect(resolved).toBe(testFile);

    // 测试创建ResolvedId
    const resolvedId = createResolvedId(testFile);
    expect(resolvedId.id).toBe(testFile.replace(/\\/g, '/'));
    expect(resolvedId.external).toBe(false);
  } finally {
    cleanupTestFiles();
  }
});

test('resolve function - relative path resolution', async () => {
  setupTestFiles();

  try {
    const { tryResolveRealFileOrType, DEFAULT_EXTENSIONS } = await import(
      '../src/utils/resolve'
    );

    // 测试相对路径解析
    const importerDir = testDir;
    const relativePath = './test.js';
    const resolved = path.resolve(importerDir, relativePath);
    const finalPath = tryResolveRealFileOrType(
      resolved,
      DEFAULT_EXTENSIONS,
      false,
    );

    expect(finalPath).toBe(testFile);
  } finally {
    cleanupTestFiles();
  }
});

test('resolve function - package resolution', async () => {
  const { findNearestPackageData, isDirectory } = await import(
    '../src/utils/resolve'
  );

  // 测试查找package.json
  const packageData = findNearestPackageData(process.cwd());
  expect(packageData).toBeTruthy();
  expect(packageData?.data).toBeTruthy();

  // 测试目录检查
  expect(isDirectory(process.cwd())).toBe(true);
  expect(isDirectory('non-existent-dir')).toBe(false);
});

test('resolve function - bare import patterns', async () => {
  const { bareImportRE, deepImportRE } = await import('../src/utils/resolve');

  // 测试bare import正则
  expect(bareImportRE.test('vue')).toBe(true);
  expect(bareImportRE.test('@vue/compiler-sfc')).toBe(true);
  expect(bareImportRE.test('./relative')).toBe(false);
  expect(bareImportRE.test('/absolute')).toBe(false);
  expect(bareImportRE.test('http://example.com')).toBe(false);

  // 测试deep import正则
  expect(deepImportRE.exec('lodash/get')?.[1]).toBe('lodash');
  expect(deepImportRE.exec('@vue/compiler-sfc/dist/index.js')?.[2]).toBe(
    '@vue/compiler-sfc',
  );
});

test('resolve function - virtual modules', async () => {
  const { createResolvedId } = await import('../src/utils/resolve');

  // 测试虚拟模块
  const virtualId = '\0virtual:test';
  const resolved = createResolvedId(virtualId);

  expect(resolved.id).toBe(virtualId);
  expect(resolved.external).toBe(false);
});
