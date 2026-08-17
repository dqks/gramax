// core/extensions/markdown/core/edit/logic/Formatter/__tests__/standardMarkdownTable.test.ts

import getNodeFormatters from "@ext/markdown/core/edit/logic/Formatter/Formatters/getNodeFormatters";
import { ProsemirrorMarkdownSerializer } from "@ext/markdown/core/edit/logic/Prosemirror";
import getMarkFormatters from "@ext/markdown/core/edit/logic/Formatter/Formatters/getMarkFormatters";
import { getSchema } from "@ext/markdown/core/edit/logic/Prosemirror/schema";
import type { JSONContent } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";

const xmlContext = {
	getProp: (name: string) => (name === "syntax" ? "XML" : undefined),
} as unknown as Parameters<typeof getNodeFormatters>[0];

const serializeDoc = async (content: JSONContent[]) => {
	const doc = Node.fromJSON(getSchema(), { type: "doc", content });
	const serializer = new ProsemirrorMarkdownSerializer(
		getNodeFormatters(xmlContext),
		getMarkFormatters(),
	);
	return await serializer.serialize(doc, {}, "");
};

// --- Хелперы для simple table ---

/** Простая ячейка (inline контент напрямую, без paragraph) */
const simpleCell = (text: string, attrs: Record<string, any> = {}): JSONContent => ({
	type: "tableCell_simple",
	attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null, ...attrs },
	content: text ? [{ type: "text", text }] : [],
});

/** Заголовочная ячейка */
const headerCell = (text: string, attrs: Record<string, any> = {}): JSONContent => ({
	type: "tableHeader_simple",
	attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null, ...attrs },
	content: text ? [{ type: "text", text }] : [],
});

/** Строка заголовка */
const headerRow = (cells: JSONContent[]): JSONContent => ({
	type: "tableHeaderRow_simple",
	content: cells,
});

/** Строка тела таблицы */
const bodyRow = (cells: JSONContent[]): JSONContent => ({
	type: "tableBodyRow_simple",
	content: cells,
});

/** Простая Markdown-таблица */
const mdTable = (header: JSONContent, body: JSONContent[]): JSONContent => ({
	type: "table_simple",
	attrs: { header: "row" },
	content: [header, ...body],
});

// ============================================================
// Тесты: Стандартные Markdown-таблицы
// ============================================================

describe("Standard Markdown tables", () => {
	test("simple table stays in pipe format", async () => {
		const result = await serializeDoc([
			mdTable(
				headerRow([headerCell("Элемент"), headerCell("Inline"), headerCell("Блок")]),
				[
					bodyRow([simpleCell("Ссылка"), simpleCell("Да"), simpleCell("Нет")]),
					bodyRow([simpleCell("Примечание"), simpleCell("Нет"), simpleCell("Да")]),
				],
			),
		]);

		expect(result).toContain("| Элемент | Inline | Блок |");
		expect(result).toContain("|---|---|---|");
		expect(result).toContain("| Ссылка | Да | Нет |");
		expect(result).toContain("| Примечание | Нет | Да |");
		expect(result).not.toContain("<table");
		expect(result).not.toContain("<tr>");
		expect(result).not.toContain("<td>");
	});

	test("alignment markers are preserved", async () => {
		const result = await serializeDoc([
			mdTable(
				headerRow([
					headerCell("Лево", { align: "left" }),
					headerCell("Центр", { align: "center" }),
					headerCell("Право", { align: "right" }),
				]),
				[
					bodyRow([simpleCell("а"), simpleCell("б"), simpleCell("в")]),
				],
			),
		]);

		expect(result).toContain(":---");
		expect(result).toContain(":---:");
		expect(result).toContain("---:");
	});

	test("cells are NOT padded with spaces to match the longest cell", async () => {
		const result = await serializeDoc([
			mdTable(
				headerRow([headerCell("Короткое"), headerCell("Очень длинное значение в этой ячейке")]),
				[
					bodyRow([simpleCell("Ещё"), simpleCell("Текст")]),
				],
			),
		]);

		const lines = result.split("\n").filter((l) => l.startsWith("|"));
		expect(lines[2]).not.toContain("Ещё      ");
		expect(lines[1].length).not.toBe(lines[2].length);
	});

	test("changing column width does NOT convert table to XML", async () => {
		const result = await serializeDoc([
			mdTable(
				headerRow([
					headerCell("Широкий", { colwidth: [300] }),
					headerCell("Узкий", { colwidth: [100] }),
				]),
				[
					bodyRow([simpleCell("а"), simpleCell("б")]),
				],
			),
		]);

		expect(result).not.toContain("<table");
		expect(result).not.toContain("<col");
		expect(result).toContain("|");
	});

	test("long inline text stays on the same line without wrapping", async () => {
		const longText = "Это очень длинный текст, который по правилам не должен переноситься на следующую строку автоматически";
		const result = await serializeDoc([
			mdTable(
				headerRow([headerCell("Колонка 1"), headerCell("Колонка 2")]),
				[
					bodyRow([simpleCell(longText), simpleCell("короткий")]),
				],
			),
		]);

		const dataLine = result.split("\n").find((l) => l.includes(longText));
		expect(dataLine).toBeDefined();
		expect(dataLine).toContain("|");
		expect(dataLine).toContain(longText);
	});

	test("Markdown table output is idempotent", async () => {
		const content = [
			mdTable(
				headerRow([headerCell("A"), headerCell("B"), headerCell("C")]),
				[
					bodyRow([simpleCell("1"), simpleCell("2"), simpleCell("3")]),
				],
			),
		];
		const first = await serializeDoc(content);
		const second = await serializeDoc(content);
		expect(second).toBe(first);
	});

	test("each table row corresponds to exactly one Markdown line", async () => {
		const result = await serializeDoc([
			mdTable(
				headerRow([headerCell("A"), headerCell("B")]),
				[
					bodyRow([simpleCell("1"), simpleCell("2")]),
					bodyRow([simpleCell("x"), simpleCell("y")]),
				],
			),
		]);

		const lines = result.split("\n").filter((l) => l.startsWith("|"));
		expect(lines.length).toBe(4); // header + separator + 2 data rows
	});

	test("table from requirements example", async () => {
		const result = await serializeDoc([
			mdTable(
				headerRow([
					headerCell("Элемент"),
					headerCell("Inline-разметка"),
					headerCell("Блочный узел"),
				]),
				[
					bodyRow([simpleCell("Ссылка"), simpleCell("Да"), simpleCell("Нет")]),
					bodyRow([simpleCell("Примечание"), simpleCell("Нет"), simpleCell("Да")]),
				],
			),
		]);

		expect(result).toContain("| Элемент | Inline-разметка | Блочный узел |");
		expect(result).toContain("| Ссылка | Да | Нет |");
		expect(result).toContain("| Примечание | Нет | Да |");
	});
});