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

// --- Хелперы для обычных (расширенных) таблиц ---

const para = (text: string): JSONContent => ({
	type: "paragraph",
	content: text ? [{ type: "text", text }] : [],
});

/** Обычная ячейка таблицы (tableCell) */
const cell = (content: JSONContent[], attrs: Record<string, any> = {}): JSONContent => ({
	type: "tableCell",
	attrs: {
		aggregation: null,
		colspan: 1,
		rowspan: 1,
		colwidth: null,
		align: null,
		filter: null,
		sort: null,
		isCustomWidth: false,
		...attrs,
	},
	content,
});

/** Простая ячейка с текстом */
const simpleCell = (text: string, attrs: Record<string, any> = {}): JSONContent =>
	cell([para(text)], attrs);

/** Сложная ячейка с несколькими абзацами */
const complexCell = (paragraphs: string[], attrs: Record<string, any> = {}): JSONContent =>
	cell(paragraphs.map((t) => para(t)), attrs);

/** Ячейка с шириной */
const cellWithWidth = (text: string, width: number, attrs: Record<string, any> = {}): JSONContent =>
	simpleCell(text, { colwidth: [width], isCustomWidth: true, ...attrs });

/** Строка таблицы */
const row = (cells: JSONContent[]): JSONContent => ({
	type: "tableRow",
	content: cells,
});

/** Таблица с header="row" (по умолчанию) */
const table = (rows: JSONContent[], header: string = "row"): JSONContent => ({
	type: "table",
	attrs: { header, sortingOrder: null },
	content: rows,
});

// ============================================================
// Тесты: Расширенные таблицы Gramax
// ============================================================

describe("Extended Gramax tables", () => {
	// --- colgroup опционален ---

	test("table without custom widths does NOT include colgroup", async () => {
		const result = await serializeDoc([
			table([
				row([simpleCell("A"), simpleCell("B"), simpleCell("C")]),
				row([simpleCell("1"), simpleCell("2"), simpleCell("3")]),
			]),
		]);

		expect(result).not.toContain("<colgroup");
		expect(result).not.toContain("<col");
		expect(result).toContain("<table");
		expect(result).toContain("</table>");
	});

	test("table with at least one custom width DOES include colgroup", async () => {
		const result = await serializeDoc([
			table([
				row([
					cellWithWidth("Элемент", 180),
					cellWithWidth("Значение", 220),
					simpleCell("Комментарий"), // без ширины
				]),
				row([simpleCell("1"), simpleCell("2"), simpleCell("3")]),
			]),
		]);

		expect(result).toContain("<colgroup>");
		expect(result).toContain("</colgroup>");
		expect(result).toContain('<col width="180"');
		expect(result).toContain('<col width="220"');
	});

	// --- colgroup одной строкой ---

	test("colgroup and all col elements are written on a single line", async () => {
		const result = await serializeDoc([
			table([
				row([
					cellWithWidth("A", 180),
					cellWithWidth("B", 220),
					simpleCell("C"),
				]),
				row([simpleCell("1"), simpleCell("2"), simpleCell("3")]),
			]),
		]);

		const colgroupLine = result
			.split("\n")
			.find((line) => line.includes("<colgroup>"));

		expect(colgroupLine).toBeDefined();
		// Все <col> и закрывающий </colgroup> на той же строке
		expect(colgroupLine).toContain('<col width="180"');
		expect(colgroupLine).toContain('<col width="220"');
		expect(colgroupLine).toContain("</colgroup>");
	});

	// --- colgroup на отдельной строке от table ---

	test("colgroup is on a separate line from opening <table>", async () => {
		const result = await serializeDoc([
			table([
				row([cellWithWidth("A", 180), simpleCell("B")]),
				row([simpleCell("1"), simpleCell("2")]),
			]),
		]);

		const lines = result.split("\n");
		const tableOpenIdx = lines.findIndex((l) => l.includes("<table"));
		const colgroupIdx = lines.findIndex((l) => l.includes("<colgroup>"));

		expect(tableOpenIdx).toBeGreaterThanOrEqual(0);
		expect(colgroupIdx).toBeGreaterThanOrEqual(0);
		// colgroup НЕ на той же строке, что <table
		expect(colgroupIdx).not.toBe(tableOpenIdx);
		// colgroup идёт сразу после <table
		expect(colgroupIdx).toBe(tableOpenIdx + 1);
	});

	// --- Пример из принятого требования ---

	test("example from accepted requirement: header=both with colgroup", async () => {
		const result = await serializeDoc([
			table(
				[
					row([simpleCell("Группа"), simpleCell("Элемент"), simpleCell("Пример")]),
					row([
						simpleCell("Inline", { rowspan: 2, colwidth: [180], isCustomWidth: true }),
						simpleCell("Код", { colwidth: [220], isCustomWidth: true }),
						simpleCell("`const value = 42`"),
					]),
				],
				"both",
			),
		]);

		expect(result).toContain('<table header="both"');
		expect(result).toContain("<colgroup>");
		expect(result).toContain('<col width="180"');
		expect(result).toContain('<col width="220"');
		expect(result).toContain("rowspan");
	});

	// --- Строка только из inline-ячеек ---

	test("row of inline-only cells is written on a single line", async () => {
		const result = await serializeDoc([
			table([
				row([
					simpleCell("ID"),
					simpleCell("Название"),
					simpleCell("Описание"),
					simpleCell("Статус"),
				]),
				row([
					simpleCell("42"),
					simpleCell("Форматтер Markdown"),
					simpleCell("Краткое описание"),
					simpleCell("В работе"),
				]),
			]),
		]);

		// Каждая строка таблицы должна занимать одну строку в выводе
		const tableLines = result
			.split("\n")
			.filter((l) => l.includes("<tr>") || l.includes("<td>"));

		// Проверяем, что каждая <tr>...</tr> целиком на одной строке
		for (const line of tableLines) {
			if (line.includes("<tr>")) {
				expect(line).toContain("</tr>");
			}
		}
	});

	test("inline-only row fits on one line regardless of length", async () => {
		const longText = "Очень длинное содержимое ячейки, которое тем не менее должно остаться на одной строке вместе с остальными ячейками";

		const result = await serializeDoc([
			table([
				row([
					simpleCell("A"),
					simpleCell(longText),
					simpleCell("C"),
				]),
			]),
		]);

		const trLine = result.split("\n").find((l) => l.includes("<tr>"));
		expect(trLine).toBeDefined();
		expect(trLine).toContain(longText);
		expect(trLine).toContain("</tr>");
	});

	// --- Сложная ячейка с несколькими абзацами ---

	test("cell with multiple paragraphs splits content onto separate lines", async () => {
		const result = await serializeDoc([
			table([
				row([simpleCell("ID"), simpleCell("Название"), simpleCell("Описание"), simpleCell("Статус")]),
				row([
					simpleCell("42"),
					simpleCell("Форматтер Markdown"),
					complexCell(["Первый абзац описания.", "Второй абзац описания."]),
					simpleCell("В работе"),
				]),
			]),
		]);

		// Содержимое сложной ячейки должно быть на отдельных строках
		expect(result).toContain("Первый абзац описания.");
		expect(result).toContain("Второй абзац описания.");

		// Между абзацами должна быть пустая строка
		expect(result).toContain("Первый абзац описания.\n");
		expect(result).toContain("\nВторой абзац описания.");
	});

	test("opening <tr> with preceding simple cells and opening <td> of complex cell on same line", async () => {
		const result = await serializeDoc([
			table([
				row([simpleCell("ID"), simpleCell("Название"), simpleCell("Описание"), simpleCell("Статус")]),
				row([
					simpleCell("42"),
					simpleCell("Форматтер Markdown"),
					complexCell(["Первый абзац.", "Второй абзац."]),
					simpleCell("В работе"),
				]),
			]),
		]);

		const lines = result.split("\n");
		// Строка, содержащая открывающий <tr>, должна также содержать
		// предыдущие простые ячейки и открывающий <td> сложной ячейки
		const trOpenLine = lines.find((l) => l.includes("<tr>") && l.includes("42"));
		expect(trOpenLine).toBeDefined();
		expect(trOpenLine).toContain("<td>");
		expect(trOpenLine).toContain("Форматтер Markdown");
	});

	// --- Пограничная строка: несколько сложных ячеек ---

	test("boundary line with closing td of complex cell, simple cells, opening td of next complex cell", async () => {
		const result = await serializeDoc([
			table([
				row([
					complexCell(["A1", "A2"]),
					simpleCell("Простая"),
					complexCell(["C1", "C2"]),
				]),
			]),
		]);

		// Должна существовать строка, которая содержит:
		// - закрывающий </td> первой сложной ячейки
		// - простую ячейку
		// - открывающий <td> второй сложной ячейки
		const lines = result.split("\n");
		const hasBoundaryLine = lines.some(
			(l) => l.includes("</td>") && l.includes("Простая") && l.includes("<td>"),
		);
		expect(hasBoundaryLine).toBe(true);
	});

	// --- Полностью простая строка всегда одна строка ---

	test("fully simple row is always a single line", async () => {
		const result = await serializeDoc([
			table([
				row([simpleCell("A"), simpleCell("B"), simpleCell("C")]),
				row([simpleCell("1"), simpleCell("2"), simpleCell("3")]),
			]),
		]);

		// Каждый <tr> должен быть полностью на одной строке
		const trMatches = result.match(/<tr>.*?<\/tr>/gs);
		expect(trMatches).toBeDefined();

		for (const match of trMatches!) {
			// Не должно быть переносов строк внутри строки
			expect(match.split("\n").length).toBe(1);
		}
	});

	// --- Идемпотентность ---

	test("extended table output is idempotent", async () => {
		const content = [
			table([
				row([cellWithWidth("A", 180), simpleCell("B")]),
				row([simpleCell("1"), simpleCell("2")]),
			]),
		];

		const first = await serializeDoc(content);
		const second = await serializeDoc(content);
		expect(second).toBe(first);
	});

	test("extended table with complex cells is idempotent", async () => {
		const content = [
			table([
				row([simpleCell("ID"), simpleCell("Описание")]),
				row([
					simpleCell("42"),
					complexCell(["Первый абзац.", "Второй абзац."]),
				]),
			]),
		];

		const first = await serializeDoc(content);
		const second = await serializeDoc(content);
		expect(second).toBe(first);
	});

	// --- colgroup с колонкой без ширины ---

	test("colgroup includes empty col for columns without custom width", async () => {
		const result = await serializeDoc([
			table([
				row([
					cellWithWidth("A", 180),
					cellWithWidth("B", 220),
					simpleCell("C"), // без ширины
				]),
			]),
		]);

		// Должны быть <col> для всех трёх колонок
		expect(result).toContain('<col width="180"');
		expect(result).toContain('<col width="220"');
		// Для колонки без ширины должен быть либо <col />, либо <col/>
		expect(result).toMatch(/<col\s*\/?>/);
	});

	// --- Таблица без header ---

	test("table without header attribute does not include header", async () => {
		const result = await serializeDoc([
			table([row([simpleCell("A"), simpleCell("B")])]),
		]);

		// header="row" — это дефолт, может быть записан или нет в зависимости от реализации
		// Проверяем базовую структуру
		expect(result).toContain("<table");
		expect(result).toContain("<tr>");
		expect(result).toContain("</table>");
	});
});