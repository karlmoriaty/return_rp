import { readRecords, encodeRecord, readManifest, encodeManifest, replaceRecord } from './rp-records.mjs';
import { parsePayload, encodePayload, field } from './parse-payload.mjs';

export function trimToSinglePage(buf) {
  const records = readRecords(buf);
  const docRec = records.find(r => r.className === 'Axure:DesignDocument');
  if (!docRec) return buf;
  const doc = parsePayload(docRec);

  const pageRecords = records.filter(r => r.className === 'Axure:Page');
  if (!pageRecords.length) return buf;

  const keepPage = pageRecords.reduce((a, b) => (a.index < b.index ? a : b));

  const manifest = readManifest(buf);
  const dataStart = manifest.dataStart;

  const panelRecords = records.filter(r => r.className === 'Axure:PanelState');

  const offsetsToRemove = new Set();
  for (const pRec of pageRecords) {
    if (pRec !== keepPage) offsetsToRemove.add(pRec.offset);
  }
  // 空白工程不应携带任何面板状态：模板里 Hero/Header/Menu 的 PanelState 记录会让
  // 已清空的页面仍被解析出孤儿 DynamicPanel，后续 set-panel-state 装配时找不到对应状态。
  for (const pRec of panelRecords) offsetsToRemove.add(pRec.offset);

  const relOffsetsToRemove = new Set([...offsetsToRemove].map(abs => abs - dataStart - 8));

  function prune(node) {
    if (node.children) {
      for (const k of Object.keys(node.children)) {
        const child = node.children[k];
        if (child?.parts?.package !== undefined) {
          if (relOffsetsToRemove.has(child.parts.package)) {
            delete node.children[k];
          } else {
            prune(child);
          }
        } else {
          prune(child);
        }
      }
      for (const k of Object.keys(node.children)) {
        const c = node.children[k];
        if (Object.keys(c.children ?? {}).length === 0
            && Object.keys(c.parts ?? {}).length === 0) {
          delete node.children[k];
        }
      }
    }
  }
  prune(manifest.value.root);

  const keptRelOffsets = new Set();
  function collect(node) {
    if (node.parts) {
      for (const v of Object.values(node.parts)) keptRelOffsets.add(v);
    }
    for (const child of Object.values(node.children ?? {})) collect(child);
  }
  collect(manifest.value.root);

  const sortedRecords = [...records].sort((a, b) => a.offset - b.offset);
  const keptRecords = sortedRecords.filter(r => keptRelOffsets.has(r.offset - dataStart - 8));

  // 每条记录前有 8 字节前缀（4 字节保留 + 4 字节 gzip 长度），parts 偏移以
  // 「记录起点 = gzip 头 - 8」相对 dataStart 计；漏掉前缀会让整条流错 4 字节。
  let cursor = 0;
  const oldToNewRel = new Map();
  const chunks = [];
  for (const r of keptRecords) {
    oldToNewRel.set(r.offset - dataStart - 8, cursor);
    chunks.push(buf.subarray(r.offset - 8, r.offset + r.compressedSize));
    cursor += r.compressedSize + 8;
  }

  const newData = Buffer.concat(chunks);

  function remap(node) {
    if (node.parts) {
      for (const [k, v] of Object.entries(node.parts)) {
        const newRel = oldToNewRel.get(v);
        if (newRel !== undefined) node.parts[k] = newRel;
      }
    }
    for (const child of Object.values(node.children ?? {})) remap(child);
  }
  remap(manifest.value.root);

  let newManifest = encodeManifest(buf, manifest.value);
  let result = Buffer.concat([newManifest, newData]);

  const rebuiltRecs = readRecords(result);
  const rebuiltDocRec = rebuiltRecs.find(r => r.className === 'Axure:DesignDocument');
  const rebuiltPageRec = rebuiltRecs.find(r => r.className === 'Axure:Page');
  if (rebuiltDocRec && rebuiltPageRec) {
    const rebuiltPageGuid = (() => {
      const pg = parsePayload(rebuiltPageRec);
      return pg.roots.find(n => n.tag === 0x1e).values[pg.roots.find(n => n.tag === 0x12).value - 1];
    })();
    const rebuiltDoc = parsePayload(rebuiltDocRec);
    const rebuiltDocGuids = rebuiltDoc.roots.find(n => n.tag === 0x1e).values;
    const pageInfos = [...rebuiltDoc.objects.values()].filter(o => o.className === 'Axure:PackageInfo'
      && rebuiltDocRec.strings[field(o.body, 'package-id').values[0] - 1] === 'Axure:Page');
    const keepInfo = pageInfos.find(o => rebuiltDocGuids[field(o.body, 'package-id').values[1] - 1] === rebuiltPageGuid);
    if (keepInfo && pageInfos.length > 1) {
      const sitemapNode = rebuiltDoc.objects.get(field(rebuiltDoc.objects.get(rebuiltDoc.roots.find(n => n.tag === 0x0f)?.value)?.body ?? {}, 'sitemap')?.value);
      const treeNode = rebuiltDoc.objects.get(field(sitemapNode?.body ?? {}, 'tree')?.value);
      const packageInfosToRemove = pageInfos.filter(p => p !== keepInfo);
      const keepPkgGuidIdx = field(keepInfo.body, 'package-id').values[1];
      const nodeTableField = field(sitemapNode?.body ?? {}, 'node-table');
      // sitemap 树以 node-table 的键值对为准。这里只保留目标页面那一个节点，
      // 其余页面/文件夹节点连同 node-table 条目一起摘除，避免残留 (节点#xxx) 空页。
      const keepNodeId = nodeTableField?.entries?.find(
        ([, val]) => val?.tag === 0x13 && val.values[1] === keepPkgGuidIdx
      )?.[0].value;
      if (nodeTableField && keepNodeId !== undefined) {
        nodeTableField.entries = nodeTableField.entries.filter(([keyNode]) => keyNode.value === keepNodeId);
        const childrenField = field(treeNode?.body ?? {}, 'children');
        if (childrenField) childrenField.items = [{ tag: 3, value: keepNodeId }];
      }
      const staleNodeIds = new Set();
      for (const o of rebuiltDoc.objects.values()) {
        if (o.className === 'Axure:Node' && o.id !== keepNodeId) staleNodeIds.add(o.id);
      }
      for (const info of packageInfosToRemove) staleNodeIds.add(info.id);

      const docRoot = rebuiltDoc.objects.get(rebuiltDoc.roots.find(n => n.tag === 0x0f)?.value);
      if (docRoot && field(docRoot.body, 'PackageInfos')) {
        field(docRoot.body, 'PackageInfos').items = field(docRoot.body, 'PackageInfos').items.filter(
          ref => ref.value === keepInfo.id
        );
      }
      rebuiltDoc.roots = rebuiltDoc.roots.filter(n => !(n.tag === 9 && staleNodeIds.has(n.id)));
      for (const id of staleNodeIds) rebuiltDoc.objects.delete(id);

      const keptStrings = [...rebuiltDocRec.strings];
      const nameNode = field(keepInfo.body, 'package-name');
      if (nameNode && nameNode.tag === 8) {
        const idx = keptStrings.indexOf('Page 1');
        if (idx >= 0) {
          nameNode.value = idx + 1;
          nameNode.text = 'Page 1';
        } else {
          keptStrings.push('Page 1');
          nameNode.value = keptStrings.length;
          nameNode.text = 'Page 1';
        }
      }

      const pruneChildrenRecursive = (nodeId) => {
        const node = rebuiltDoc.objects.get(nodeId);
        if (!node) return;
        const childrenList = field(node.body, 'children');
        const items = childrenList?.items;
        if (items) {
          childrenList.items = items.filter(ref => rebuiltDoc.objects.has(ref.value));
          for (const ref of childrenList.items) pruneChildrenRecursive(ref.value);
        }
      };
      const docRootNodeId = rebuiltDoc.roots.find(n => n.tag === 0x0f)?.value;
      if (docRootNodeId) {
        const docRoot = rebuiltDoc.objects.get(docRootNodeId);
        const sitemap = rebuiltDoc.objects.get(field(docRoot.body, 'sitemap')?.value);
        const tree = rebuiltDoc.objects.get(field(sitemap?.body ?? {}, 'tree')?.value);
        if (tree) pruneChildrenRecursive(tree.id);
      }

      result = replaceRecord(result, rebuiltDocRec, encodeRecord(rebuiltDocRec, keptStrings, encodePayload(rebuiltDoc.roots)));
    }
  }

  // 空白工程页面必须真的没有任何元件：模板首页残留的 Hero/Header/Menu 虽然已从
  // diagram-objects 摘除，但对象本身仍在 roots 里，会被当成活动 DynamicPanel。
  const finalRecords = readRecords(result);
  const finalPageRec = finalRecords.find(r => r.className === 'Axure:Page' && r.index === (rebuiltPageRec?.index ?? 0))
    ?? finalRecords.find(r => r.className === 'Axure:Page');
  if (finalPageRec) {
    const pg = parsePayload(finalPageRec);
    const pageObj = [...pg.objects.values()].find(o => o.className === 'Axure:Page');
    const diagram = pg.objects.get(field(pageObj?.body ?? {}, 'diagram')?.value);
    const objectsField = field(diagram?.body ?? {}, 'diagram-objects');
    if (objectsField) objectsField.items = [];

    const reachable = new Set();
    const collectRefs = n => {
      if (n.tag === 3) reachable.add(n.value);
      if (n.entries) for (const [k, v] of n.entries) { collectRefs(k); collectRefs(v); }
      if (n.items) for (const it of n.items) collectRefs(it);
      if (n.tag === 9) collectRefs(n.body);
    };
    for (const root of pg.roots) if (root.tag !== 9) collectRefs(root);
    for (const o of pg.objects.values()) {
      if (o.className?.startsWith('Axure:DiagramObject:') || o.className === 'Axure:Style') continue;
      collectRefs(o.body);
    }
    const orphanIds = new Set();
    for (const o of pg.objects.values()) {
      const isDiagramObject = o.className?.startsWith('Axure:DiagramObject:') || o.className === 'Axure:Style';
      if (isDiagramObject && !reachable.has(o.id)) orphanIds.add(o.id);
    }
    if (orphanIds.size) {
      pg.roots = pg.roots.filter(n => !(n.tag === 9 && orphanIds.has(n.id)));
      result = replaceRecord(result, finalPageRec, encodeRecord(finalPageRec, finalPageRec.strings, encodePayload(pg.roots)));
    }
  }
  return result;
}
