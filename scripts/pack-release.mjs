import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, constants } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertWritable } from './engine.mjs';
import { listCommands } from './registry.mjs';
import { listMcpTools, jobTools } from './mcp-tools.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TOP = ['README.md', 'README.en.md', 'README.zh-CN.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'LICENSE', 'SKILL.md', '.gitignore', '.npmignore', 'package.json', 'package-lock.json', 'requirements.txt'];
const DIRS = ['bin', 'scripts', 'studio', 'test', 'references', 'examples', 'docs', 'assets', 'tools', 'benchmarks', '.github'];
const EXTENSIONS = /\.(m?js|html|css|py|swift|md|json|rp1|svg|png|jpe?g|webp|gif|ya?ml|ttf|txt)$/;

// Copy the public source without pruning implementations, tests, or rewriting their contents.
export function releasePaths(root = ROOT) {
  const paths = TOP.filter(path => existsSync(join(root, path)));
  const packagePath = join(root, 'package.json');
  const declared = existsSync(packagePath) ? JSON.parse(readFileSync(packagePath, 'utf8')).files : null;
  const publicTests = Array.isArray(declared) ? new Set(declared.filter(path => path.startsWith('test/'))) : null;
  const walk = dir => {
    if (!existsSync(join(root, dir))) return;
    for (const item of readdirSync(join(root, dir), { withFileTypes: true })) {
      if (['node_modules', '__pycache__', '.venv', '.git', 'outputs', '.proto-axvg-cache'].includes(item.name)) continue;
      const path = `${dir}/${item.name}`;
      // Workspace-specific research harnesses are not public regression sources.
      if (item.isFile() && path.startsWith('test/') && publicTests && !publicTests.has(path)) continue;
      if (dir === 'test/fixtures' && item.isFile() && !publicTests?.has(path) && !['rp-aggregate-cases.json', 'rp-aggregate-matrix.json', 'rp-aggregate-panel.json', 'rp-aggregate-startup.json', 'rp-native-visual.json', 'rp1-master-adaptive.json', 'round3-runtime-rows.json', 'round3-master-slot.json'].includes(item.name)) continue;
      if (item.isDirectory()) walk(path);
      else if (item.isFile() && EXTENSIONS.test(item.name)) paths.push(path);
    }
  };
  for (const dir of DIRS) walk(dir);
  return paths.sort();
}

// 轻量分享包：发布集去掉测试、基准、CI 配置与二进制样本，体积小但仍须能独立启动。
const SHARE_EXCLUDES = [/^test\//, /^benchmarks\//, /^\.github\//, /\.rp$/, /^release-manifest\.json$/];
export function sharePaths(root = ROOT) {
  return releasePaths(root).filter(path => !SHARE_EXCLUDES.some(pattern => pattern.test(path)));
}

// 静态 import 闭包校验：分享包曾漏掉 trim-to-single-page.mjs，MCP 一启动就 ERR_MODULE_NOT_FOUND。
const RELATIVE_IMPORT = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"](\.[^'"]+)['"]|import\(\s*['"](\.[^'"]+)['"]\s*\)/g;
export function assertImportClosure(paths, root = ROOT) {
  const published = new Set(paths), missing = [];
  for (const path of paths) {
    if (!/\.m?js$/.test(path)) continue;
    const text = readFileSync(join(root, path), 'utf8');
    for (const match of text.matchAll(RELATIVE_IMPORT)) {
      const target = relative(root, resolve(root, dirname(path), match[1] || match[2])).split(sep).join('/');
      if (!published.has(target)) missing.push(`${path} -> ${target}`);
    }
  }
  if (missing.length) throw new Error(`发布集缺少被引用的模块：\n${missing.join('\n')}`);
  return paths.length;
}

export function packRelease(destination) {
  const output = resolve(destination);
  assertWritable(output);
  if (existsSync(output)) throw new Error('Release directory must be a new directory');
  const paths = releasePaths();
  assertImportClosure(paths);
  const files = {};
  mkdirSync(output);
  for (const path of paths) {
    const target = join(output, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(ROOT, path), target, constants.COPYFILE_EXCL);
    files[relative(output, target).split(sep).join('/')] = createHash('sha256').update(readFileSync(target)).digest('hex');
  }
  const manifest = { version: JSON.parse(readFileSync(join(ROOT, 'package.json'))).version,
    commands: listCommands().length, mcpTools: listMcpTools().length + jobTools.length, files };
  writeFileSync(join(output, 'release-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  return { output, files: paths.length, commands: manifest.commands, mcpTools: manifest.mcpTools };
}

export function packShare(destination) {
  const output = resolve(destination);
  assertWritable(output);
  if (existsSync(output)) throw new Error('Share directory must be a new directory');
  const paths = sharePaths();
  assertImportClosure(paths);
  mkdirSync(output);
  for (const path of paths) {
    const target = join(output, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(ROOT, path), target, constants.COPYFILE_EXCL);
  }
  return { output, files: paths.length };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const share = process.argv[2] === '--share';
  const args = share ? process.argv.slice(3) : process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '-o') throw new Error('Usage: node scripts/pack-release.mjs [-o <new-directory>] [--share -o <new-directory>]');
  console.log(JSON.stringify(share ? packShare(args[1]) : packRelease(args[1]), null, 2));
}
