import type { CellAttrs } from "@ext/markdown/elements/table/edit/model/columnResizing/CellAttrs";
import type { Node } from "prosemirror-model";

export function updateColumnsOnResize(
	node: Node,
	colgroup: HTMLTableColElement,
	table: HTMLTableElement,
	overrideCol?: number,
	overrideValue?: number,
): void {
	let nextDOM = colgroup.firstChild as HTMLElement;
	const row = node.firstChild;
	if (!row) return;

	for (let i = 0, col = 0; i < row.childCount; i++) {
		const { colspan, colwidth } = row.child(i).attrs as CellAttrs;
		for (let j = 0; j < colspan; j++, col++) {
			const hasWidth = overrideCol == col ? overrideValue : colwidth && colwidth[j];
			const cssWidth = hasWidth + "px";
			if (!nextDOM) {
				colgroup.appendChild(document.createElement("col"));
			} else {
				if (hasWidth && nextDOM.style.minWidth != cssWidth) {
					nextDOM.style.width = cssWidth;
					nextDOM.style.minWidth = cssWidth;
				}
				nextDOM = nextDOM.nextSibling as HTMLElement;
			}
		}
	}

	while (nextDOM) {
		const after = nextDOM.nextSibling;
		nextDOM.parentNode?.removeChild(nextDOM);
		nextDOM = after as HTMLElement;
	}
}

// export function updateColumnsOnResize(
// 	node: Node,
// 	colgroup: HTMLTableColElement,
// 	table: HTMLTableElement,
// 	overrideCol?: number,
// 	overrideValue?: number,
// ): void {
// 	const row = node.firstChild;
// 	if (!row) return;
//
// 	const colWidths: (number | null)[] = [];
// 	let totalUsedWidth = 0;
// 	let autoColCount = 0;
// 	let explicitWidthCount = 0;
//
// 	for (let i = 0, col = 0; i < row.childCount; i++) {
// 		const { colspan, colwidth } = row.child(i).attrs as CellAttrs;
// 		for (let j = 0; j < colspan; j++, col++) {
// 			const hasWidth = overrideCol == col ? overrideValue : colwidth && colwidth[j];
// 			colWidths[col] = hasWidth || null;
// 			if (hasWidth && hasWidth > 0) {
// 				totalUsedWidth += hasWidth;
// 				explicitWidthCount++;
// 			} else {
// 				autoColCount++;
// 			}
// 		}
// 	}
//
// 	let autoWidth: number;
// 	const tableWidth = table.getBoundingClientRect().width;
//
// 	if (tableWidth > 100 && autoColCount > 0) {
// 		const availableWidth = tableWidth - totalUsedWidth;
// 		autoWidth = Math.max(100, Math.floor(availableWidth / autoColCount));
// 	} else if (explicitWidthCount > 0 && autoColCount > 0) {
// 		autoWidth = Math.floor(totalUsedWidth / explicitWidthCount);
// 	} else {
// 		autoWidth = 150;
// 	}
//
// 	// Второй проход: устанавливаем ширины в DOM
// 	let nextDOM = colgroup.firstChild as HTMLElement;
// 	for (let col = 0; col < colWidths.length; col++) {
// 		const width = colWidths[col] && colWidths[col] > 0 ? colWidths[col] : autoWidth;
// 		const cssWidth = width + "px";
//
// 		if (!nextDOM) {
// 			const colEl = document.createElement("col");
// 			colEl.style.width = cssWidth;
// 			colEl.style.minWidth = cssWidth;
// 			colgroup.appendChild(colEl);
// 		} else {
// 			if (nextDOM.style.minWidth !== cssWidth) {
// 				nextDOM.style.width = cssWidth;
// 				nextDOM.style.minWidth = cssWidth;
// 			}
// 			nextDOM = nextDOM.nextSibling as HTMLElement;
// 		}
// 	}
//
// 	while (nextDOM) {
// 		const after = nextDOM.nextSibling;
// 		nextDOM.parentNode?.removeChild(nextDOM);
// 		nextDOM = after as HTMLElement;
// 	}
// }