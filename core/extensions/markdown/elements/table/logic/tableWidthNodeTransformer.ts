import type { JSONContent } from "@tiptap/core";

export const tableWidthNodeTransformer = (node: JSONContent): JSONContent => {
    if (node.type === 'table_simple' || node.type === 'table') {
        if (!node.content) return node;

        const headerRow = node.content[0];
        if (!headerRow || !headerRow.content) return node;

        const colWidths: { [index: number]: number } = {};
        let hasWidth = false;

        for (let cellIdx = 0; cellIdx < headerRow.content.length; cellIdx++) {
            const cell = headerRow.content[cellIdx];
            if (!cell.content || cell.content.length === 0) continue;

            const firstChild = cell.content[0];
            if (firstChild.type !== 'paragraph' || !firstChild.content || firstChild.content.length === 0) continue;

            const textNode = firstChild.content[0];
            if (textNode.type !== 'text' || !textNode.text) continue;

            const widthMatch = textNode.text.match(/\{width=(\d+)px\}/);
            if (widthMatch) {
                const width = parseInt(widthMatch[1]);
                colWidths[cellIdx] = width;
                hasWidth = true;

                textNode.text = textNode.text.replace(/\{width=\d+px\}/, '').trim();
                if (!textNode.text) {
                    firstChild.content.shift();
                }
            }
        }

        if (hasWidth) {
            for (const row of node.content) {
                if (!row.content) continue;
                for (let cellIdx = 0; cellIdx < row.content.length; cellIdx++) {
                    const cell = row.content[cellIdx];
                    const width = colWidths[cellIdx];
                    if (width !== undefined) {
                        cell.attrs = cell.attrs || {};
                        cell.attrs.colwidth = [width];
                        cell.attrs.isCustomWidth = true;
                    } else {
                        cell.attrs = cell.attrs || {};
                        cell.attrs.colwidth = [0];
                        cell.attrs.isCustomWidth = false;
                    }
                }
            }
        }
    }
    return node;
};