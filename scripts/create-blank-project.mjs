import { copyFileSync, readFileSync, writeFileSync, constants } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRecords } from './rp-records.mjs';
import { readRp } from './rp-read.mjs';
import { parsePayload, field } from './parse-payload.mjs';

import { resolveBlankTemplate } from './blank-template.mjs';
import { assertNotProtected } from './engine.mjs';
import { DEFAULT_VERSION, detectFileVersion, resolveTargetVersion } from './version.mjs';
import { trimToSinglePage } from './trim-to-single-page.mjs';

export function createBlankProject(outputPath, { version = DEFAULT_VERSION } = {}) {
  const target = resolveTargetVersion(version);
  const TEMPLATE = resolveBlankTemplate(target);
  const output = resolve(outputPath);
  assertNotProtected(output);
  if (extname(output).toLowerCase() !== '.rp') throw new Error('Output path must end in .rp');

  let template = readFileSync(TEMPLATE);
  const summary = readRp(template, { path: TEMPLATE });
  const records = readRecords(template);
  const page = records.find(record => record.index === summary.pages[0]?.record && record.className === 'Axure:Page');
  const graph = page && parsePayload(page);
  const pageObject = graph && [...graph.objects.values()].find(object => object.className === 'Axure:Page');
  const diagram = pageObject && graph.objects.get(field(pageObject.body, 'diagram')?.value);
  const objects = field(diagram?.body ?? {}, 'diagram-objects')?.items ?? [];

  // 「干净模板」= 单页、无元件、无面板状态、无母版：这就是 Axure 自己保存的空白工程，
  // 不需要任何裁剪。裁剪只会引入孤儿对象/母版树残留，Axure 加载时会报 null 引用。
  const dirty = summary.pages.length > 1
    || summary.counts.widgets !== 0
    || summary.counts.panelStates !== 0
    || objects.length !== 0
    || summary.counts.masters > 0;
  if (dirty) {
    console.error(`[INFO] Template is not pristine (pages=${summary.pages.length} widgets=${summary.counts.widgets} panelStates=${summary.counts.panelStates} masters=${summary.counts.masters}); trimming`);
    template = trimToSinglePage(template);
    const postSummary = readRp(template, { path: TEMPLATE });
    console.error(`[INFO] After trim: pages=${postSummary.pages.length} widgets=${postSummary.counts.widgets} panelStates=${postSummary.counts.panelStates} masters=${postSummary.counts.masters}`);
  }
  copyFileSync(TEMPLATE, output, constants.COPYFILE_EXCL);
  if (dirty) {
    writeFileSync(output, template);
  }
  return {
    output,
    version: detectFileVersion(template),
    template: TEMPLATE,
    page: readRp(template).pages[0]?.name ?? 'Page 1',
    pages: readRp(template).counts.pages,
    widgets: readRp(template).counts.widgets,
    panelStates: readRp(template).counts.panelStates,
    bytes: template.length
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // 注意：不能用「第一个非 -- 开头的参数」直接取 output，--version 的值会被误当路径。
  const argv = process.argv.slice(2);
  const positional = [];
  let version = DEFAULT_VERSION;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--version') { version = argv[++i]; continue; }
    if (argv[i].startsWith('--')) continue;
    positional.push(argv[i]);
  }
  const output = positional[0];
  if (!output) {
    console.error('Usage: node create-blank-project.mjs <output.rp> [--version 9|11]');
    process.exit(1);
  }
  console.log(JSON.stringify(createBlankProject(output, { version }), null, 2));
}
