import type ParserContext from "@ext/markdown/core/Parser/ParserContext/ParserContext";
import { Node } from "prosemirror-model";
import { getSchema, ProsemirrorMarkdownSerializer } from "../../Prosemirror";
import getMarkFormatters from "../Formatters/getMarkFormatters";
import getNodeFormatters from "../Formatters/getNodeFormatters";

const TableUtils = {
	async getSimpleTable(node: Node, delim: string, context: ParserContext): Promise<string> {
		const table = node.toJSON();
		table.type = "table_simple";

		const colWidths: { [index: number]: number } = {};
		const headerRow = table.content?.[0];

		if (headerRow && headerRow.content) {
			for (let cellIdx = 0; cellIdx < headerRow.content.length; cellIdx++) {
				const cell = headerRow.content[cellIdx];
				const width = cell.attrs?.colwidth?.[0];
				const isCustom = cell.attrs?.isCustomWidth === true;

				if (isCustom && width !== undefined && width !== null) {
					colWidths[cellIdx] = width;
				}
			}
		}

		for (let rowIdx = 0; rowIdx < table.content.length; rowIdx++) {
			const row = table.content[rowIdx];
			if (rowIdx === 0) row.type = "tableHeaderRow_simple";
			else row.type = "tableBodyRow_simple";
			for (let cellIdx = 0; cellIdx < row.content.length; cellIdx++) {
				const cell = row.content[cellIdx];
				if (rowIdx === 0) cell.type = "tableHeader_simple";
				else cell.type = "tableCell_simple";

				if (cell.content && cell.content.length > 0 && cell.content[0].type === "paragraph") {
					const paragraph = cell.content[0];
					cell.content = paragraph.content || [];
				}

				if (!cell.content) cell.content = [];

				for (const node of cell.content) {
					if (node.type === "text" && node.text) {
						node.text = node.text.replace(/\s*\{width=\d+px\}/g, "");
					}
				}

				cell.content = cell.content.filter(
					(node: any) => node.type !== "text" || node.text.length > 0
				);

				if (rowIdx === 0 && colWidths[cellIdx] !== undefined) {
					cell.content.push({
						type: "text",
						text: ` {width=${colWidths[cellIdx]}px}`,
					});
				}
			}
		}

		return TableUtils.prettifySimpleTable(
			await new ProsemirrorMarkdownSerializer(
				getNodeFormatters(context),
				getMarkFormatters(context)
			).serialize(
				Node.fromJSON(getSchema(), { type: "doc", content: [table] }),
				{ escapeExtraCharacters: /\|/g },
				delim,
			),
		);
	},
	prettifySimpleTable(SimpleTable: string): string {
		return SimpleTable.replace(/\\\{/g, "{").replace(/\\\}/g, "}");
	},
	tableIsSimple(node: Node): boolean {
		if (node.childCount <= 1) return false;
		let tableIsSimple = true;
		if (node.attrs.header !== "row") tableIsSimple = false;
		node.forEach((n) => {
			if (tableIsSimple && !TableUtils.rowIsSimple(n)) tableIsSimple = false;
		});
		return tableIsSimple;
	},
	rowIsSimple(node: Node): boolean {
		let rowIsSimple = true;
		node.forEach((n) => {
			if (rowIsSimple && !TableUtils.cellIsSimple(n)) rowIsSimple = false;
		});
		return rowIsSimple;
	},
	cellIncludeLineBreaks(childContent: Node) {
		let hasHardBreak = false;
		childContent.forEach((node) => {
			if (node.type.name === "hard_break" || node.type.name === "br") {
				hasHardBreak = true;
				return false;
			}
		});
		return hasHardBreak;
	},
	cellIsSimple(node: Node): boolean {
		if (node.childCount === 0) return true;
		if (node.childCount > 1) return false;
		if (node.firstChild.type.name !== "paragraph") return false;
		if (this.cellIncludeLineBreaks(node.content.firstChild)) return false;

		const attrs = { ...node.attrs };
		delete attrs.colwidth;
		delete attrs.isCustomWidth;

		if (
			attrs.aggregation !== null ||
			attrs.colspan !== 1 ||
			attrs.rowspan !== 1 ||
			attrs.align !== null ||
			attrs.filter !== null ||
			attrs.sort !== null
		) {
			return false;
		}

		let cellIsSimple = true;
		node.firstChild.forEach((n) => {
			if (cellIsSimple && !n.isInline) cellIsSimple = false;
		});

		return cellIsSimple;
	},
	getOldCellAttributes(attrs: { [name: string]: boolean | string | number }): string {
		if (attrs.colspan === 1) attrs.colspan = null;
		if (attrs.rowspan === 1) attrs.rowspan = null;
		const attributes = Object.keys(attrs)
		.map((key) => {
			if (!attrs[key]) return null;
			if (typeof attrs[key] === "string") return `${key}="${attrs[key]}"`;
			if (Array.isArray(attrs[key])) return `${key}=[${attrs[key].join(",")}]`;

			return `${key}=${attrs[key]}`;
		})
		.filter((a) => a);
		if (attributes.length === 0) return "";
		return `{% ${attributes.join(" ")} %}\n\n`;
	},
};

export default TableUtils;
