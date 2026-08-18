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

const cell = (text: string, attrs: Record<string, any> = {}): JSONContent => ({
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
	content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }],
});

const cellWithWidth = (text: string, width: number, attrs: Record<string, any> = {}): JSONContent =>
	cell(text, { colwidth: [width], isCustomWidth: true, ...attrs });

const row = (cells: JSONContent[]): JSONContent => ({
	type: "tableRow",
	content: cells,
});

const table = (rows: JSONContent[]): JSONContent => ({
	type: "table",
	attrs: { header: "row", sortingOrder: null },
	content: rows,
});

describe("Table resize attributes", () => {
	// --- Атрибут {width=Npx} в заголовке ---

	test("colwidth with isCustomWidth renders as {width=Npx} attribute", async () => {
		const result = await serializeDoc([
			table([
				row([
					cellWithWidth("Элемент", 180),
					cellWithWidth("Значение", 220),
					cell("Комментарий"),
				]),
				row([cell("Ссылка"), cell("Да"), cell("Относительная")]),
			]),
		]);

		expect(result).toContain("| Элемент {width=180px} |");
		expect(result).toContain("| Значение {width=220px} |");
		expect(result).toContain("| Комментарий |");
		expect(result).not.toMatch(/Комментарий \{width=/);
	});

	// --- Таблица остаётся в Markdown-формате ---

	test("table with colwidth stays in pipe format (NOT XML)", async () => {
		const result = await serializeDoc([
			table([
				row([
					cellWithWidth("Широкий", 300),
					cellWithWidth("Узкий", 100),
				]),
				row([cell("а"), cell("б")]),
			]),
		]);

		expect(result).not.toContain("<table");
		expect(result).not.toContain("<col");
		expect(result).not.toContain("<tr>");
		expect(result).not.toContain("<td>");
		expect(result).toContain("|");
		expect(result).toContain("|---");
	});

	// --- Атрибут записывается в конце содержимого ---

	test("width attribute is placed at the end of header cell content", async () => {
		const result = await serializeDoc([
			table([
				row([cellWithWidth("Название", 200)]),
				row([cell("Текст")]),
			]),
		]);

		expect(result).toMatch(/Название \{width=200px\} \|/);
		expect(result).not.toMatch(/\{width=200px\} Название/);
	});

	// --- Автоматическая ширина не записывается ---

	test("automatic width (no colwidth) does not add {width=auto} attribute", async () => {
		const result = await serializeDoc([
			table([
				row([
					cell("Без ширины"),
					cellWithWidth("С шириной", 150),
				]),
				row([cell("а"), cell("б")]),
			]),
		]);

		expect(result).toContain("| Без ширины |");
		expect(result).not.toMatch(/Без ширины \{width=/);
		expect(result).toContain("| С шириной {width=150px} |");
	});

	// --- Множественные атрибуты ---

	test("multiple attributes are separated by space, not comma", async () => {
		const result = await serializeDoc([
			table([
				row([cellWithWidth("Элемент", 180)]),
				row([cell("Текст")]),
			]),
		]);

		const widthMatch = result.match(/\{([^}]+)\}/);
		expect(widthMatch).toBeDefined();
		if (widthMatch) {
			const attrs = widthMatch[1];
			expect(attrs).not.toContain(",");
			if (attrs.includes(" ")) {
				expect(attrs).toMatch(/\w+=\S+ \w+=\S+/);
			}
		}
	});

	// --- Изменение ширины меняет только заголовок ---

	test("changing column width only affects the header row", async () => {
		const result = await serializeDoc([
			table([
				row([
					cellWithWidth("Колонка 1", 200),
					cellWithWidth("Колонка 2", 300),
				]),
				row([cell("Данные 1"), cell("Данные 2")]),
				row([cell("Ещё данные"), cell("Ещё")]),
			]),
		]);

		const lines = result.split("\n").filter((l) => l.startsWith("|"));

		expect(lines[0]).toContain("{width=200px}");
		expect(lines[0]).toContain("{width=300px}");
		expect(lines[2]).not.toContain("{width=");
		expect(lines[3]).not.toContain("{width=");
	});

	// --- Идемпотентность ---

	test("table with colwidth is idempotent", async () => {
		const content = [
			table([
				row([
					cellWithWidth("Элемент", 180),
					cellWithWidth("Значение", 220),
				]),
				row([cell("Ссылка"), cell("Да")]),
			]),
		];

		const first = await serializeDoc(content);
		const second = await serializeDoc(content);
		expect(second).toBe(first);
	});

	// --- Пример из требования ---

	test("example from requirements", async () => {
		const result = await serializeDoc([
			table([
				row([
					cellWithWidth("Элемент", 180),
					cellWithWidth("Значение", 220),
					cell("Комментарий"),
				]),
				row([cell("Ссылка"), cell("Да"), cell("Относительная")]),
			]),
		]);

		expect(result).toContain("| Элемент {width=180px} |");
		expect(result).toContain("| Значение {width=220px} |");
		expect(result).toContain("| Комментарий |");
		expect(result).toContain("| Ссылка | Да | Относительная |");
		expect(result).not.toContain("<table");
		expect(result).toContain("|");
		expect(result).toContain("|---");
	});

	// --- Выравнивание сохраняется вместе с шириной ---

	// test("alignment markers are preserved with width attributes", async () => {
	// 	const result = await serializeDoc([
	// 		table([
	// 			row([
	// 				cellWithWidth("Лево", 150, { align: "left" }),
	// 				cellWithWidth("Центр", 200, { align: "center" }),
	// 				cellWithWidth("Право", 250, { align: "right" }),
	// 			]),
	// 			row([cell("а"), cell("б"), cell("в")]),
	// 		]),
	// 	]);

	// 	expect(result).toContain("Лево {width=150px}");
	// 	expect(result).toContain("Центр {width=200px}");
	// 	expect(result).toContain("Право {width=250px}");
	// 	expect(result).toContain(":---");
	// 	expect(result).toContain(":---:");
	// 	expect(result).toContain("---:");
	// });

	// --- Флаг isCustomWidth ---

	test("colwidth without isCustomWidth=true does NOT add {width=Npx} attribute", async () => {
		const result = await serializeDoc([
			table([
				row([
					cell("Колонка", { colwidth: [200], isCustomWidth: false }),
				]),
				row([cell("Текст")]),
			]),
		]);

		expect(result).toContain("| Колонка |");
		expect(result).not.toMatch(/Колонка \{width=/);
	});

	test("isCustomWidth=true without colwidth does NOT add {width=Npx} attribute", async () => {
		const result = await serializeDoc([
			table([
				row([
					cell("Колонка", { isCustomWidth: true }),
				]),
				row([cell("Текст")]),
			]),
		]);

		expect(result).toContain("| Колонка |");
		expect(result).not.toMatch(/Колонка \{width=/);
	});
});