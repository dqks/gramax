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

const para = (text: string): JSONContent => ({
	type: "paragraph",
	content: text ? [{ type: "text", text }] : [],
});

const listItem = (...content: JSONContent[]): JSONContent => ({
	type: "listItem",
	content,
});

const bulletList = (...items: JSONContent[]): JSONContent => ({
	type: "bulletList",
    attrs: { tight: true, containTaskList: false },
	content: items,
});

const orderedList = (...items: JSONContent[]): JSONContent => ({
	type: "orderedList",
    attrs: { order: 1, tight: true },
	content: items,
});


describe("List spacing", () => {

	test("no blank lines between adjacent list items", async () => {
		const result = await serializeDoc([
			bulletList(
				listItem(para("Первый пункт")),
				listItem(para("Второй пункт")),
				listItem(para("Третий пункт")),
			),
		]);

		const lines = result.split("\n");

		// Между пунктами не должно быть пустых строк
		expect(lines[0]).toBe("- Первый пункт");
		expect(lines[1]).toBe("- Второй пункт");
		expect(lines[2]).toBe("- Третий пункт");

		// Проверяем, что нет пустых строк между пунктами
		expect(result).not.toContain("- Первый пункт\n\n- Второй пункт");
		expect(result).not.toContain("- Второй пункт\n\n- Третий пункт");
	});


	test("no blank lines between nesting levels", async () => {
		const result = await serializeDoc([
			bulletList(
				listItem(para("Первый пункт")),
				listItem(
					para("Второй пункт"),
					bulletList(
						listItem(
							para("Вложенный пункт"),
							bulletList(listItem(para("Третий уровень"))),
						),
					),
				),
				listItem(para("Третий пункт")),
			),
		]);

		const lines = result.split("\n");

		expect(lines[0]).toBe("- Первый пункт");
		expect(lines[1]).toBe("- Второй пункт");
		expect(lines[2]).toMatch(/^ {2}- Вложенный пункт$/);
		expect(lines[3]).toMatch(/^ {4}- Третий уровень$/);
		expect(lines[4]).toBe("- Третий пункт");

		// Нет пустых строк между уровнями
		expect(result).not.toContain("\n\n  -");
		expect(result).not.toContain("\n\n    -");
	});

	// test("blank line appears only between paragraphs within the same item", async () => {
	// 	const result = await serializeDoc([
	// 		bulletList(
	// 			listItem(para("Первый пункт")),
	// 			listItem(
	// 				para("Пункт с несколькими абзацами"),
	// 				para("Второй абзац того же пункта."),
	// 			),
	// 			listItem(para("Третий пункт")),
	// 		),
	// 	]);

	// 	const lines = result.split("\n");

	// 	expect(lines[0]).toBe("- Первый пункт");
	// 	expect(lines[1]).toBe("- Пункт с несколькими абзацами");
	// 	// Продолжение выравнивается по колонке текста (2 пробела для "- ")
	// 	expect(lines[2]).toMatch(/^ {2}Второй абзац того же пункта\.$/);
	// 	expect(lines[3]).toBe("- Третий пункт");
	// });

	// test("continuation aligns to the text column of the current item", async () => {
	// 	const result = await serializeDoc([
	// 		bulletList(
	// 			listItem(
	// 				para("Первый абзац"),
	// 				para("Второй абзац продолжения"),
	// 			),
	// 		),
	// 	]);

	// 	const lines = result.split("\n");

	// 	// "- " занимает 2 символа, продолжение начинается с колонки 2
	// 	expect(lines[0]).toBe("- Первый абзац");
	// 	expect(lines[1]).toMatch(/^ {2}Второй абзац продолжения$/);

	// 	// Не должно быть фиксированного отступа в 4 пробела
	// 	expect(lines[1]).not.toMatch(/^ {4}Второй абзац/);
	// });

	// test("nested item continuation increases indent with list level", async () => {
	// 	const result = await serializeDoc([
	// 		bulletList(
	// 			listItem(
	// 				para("Родитель"),
	// 				bulletList(
	// 					listItem(
	// 						para("Пункт с несколькими абзацами"),
	// 						para("Второй абзац вложенного пункта."),
	// 					),
	// 				),
	// 			),
	// 		),
	// 	]);

	// 	const lines = result.split("\n");

	// 	// Родительский пункт
	// 	expect(lines[0]).toBe("- Родитель");
	// 	// Вложенный пункт с отступом 2 пробела
	// 	expect(lines[1]).toMatch(/^ {2}- Пункт с несколькими абзацами$/);
	// 	// Продолжение вложенного пункта: отступ 2 (уровень) + 2 (колонка текста) = 4
	// 	expect(lines[2]).toMatch(/^ {4}Второй абзац вложенного пункта\.$/);
	// });

	test("short child blocks have no blank lines", async () => {
		const result = await serializeDoc([
			bulletList(
				listItem(
					para("Пункт с кодом"),
					{
						type: "code_block",
						attrs: { language: null },
						content: [{ type: "text", text: "const x = 1;" }],
					},
				),
				listItem(para("Следующий пункт")),
			),
		]);

		// Между пунктом с кодом и следующим пунктом не должно быть пустой строки
		expect(result).not.toContain("\n\n- Следующий пункт");
	});

	test("list output is idempotent", async () => {
		const content = [
			bulletList(
				listItem(para("Первый")),
				listItem(
					para("Второй"),
					bulletList(listItem(para("Вложенный"))),
				),
				listItem(para("Третий")),
			),
		];

		const first = await serializeDoc(content);
		const second = await serializeDoc(content);
		expect(second).toBe(first);
	});

	test("simple list", async () => {
		const result = await serializeDoc([
			bulletList(
				listItem(para("Первый пункт")),
				listItem(
					para("Второй пункт"),
					bulletList(
						listItem(
							para("Вложенный пункт"),
							bulletList(listItem(para("Третий уровень"))),
						),
					),
				),
				listItem(para("Третий пункт")),
			),
		]);

		const expected =
			"- Первый пункт\n" +
			"- Второй пункт\n" +
			"  - Вложенный пункт\n" +
			"    - Третий уровень\n" +
			"- Третий пункт";

		expect(result).toBe(expected);
	});

	// test("multi-paragraph item", async () => {
	// 	const result = await serializeDoc([
	// 		bulletList(
	// 			listItem(para("Первый пункт")),
	// 			listItem(
	// 				para("Пункт с несколькими абзацами"),
	// 				para("Второй абзац того же пункта."),
	// 			),
	// 			listItem(para("Третий пункт")),
	// 		),
	// 	]);

	// 	const expected =
	// 		"- Первый пункт\n" +
	// 		"- Пункт с несколькими абзацами\n" +
	// 		"  Второй абзац того же пункта.\n" +
	// 		"- Третий пункт\n"; // ← добавлен \n

	// 	expect(result).toBe(expected);
	// });

	// test("nested multi-paragraph item", async () => {
	// 	const result = await serializeDoc([
	// 		bulletList(
	// 			listItem(
	// 				para("Родитель"),
	// 				bulletList(
	// 					listItem(
	// 						para("Пункт с несколькими абзацами"),
	// 						para("Второй абзац вложенного пункта."),
	// 					),
	// 				),
	// 			),
	// 		),
	// 	]);

	// 	const expected =
	// 		"- Родитель\n" +
	// 		"  - Пункт с несколькими абзацами\n" +
	// 		"    Второй абзац вложенного пункта.\n"; // ← добавлен \n

	// 	expect(result).toBe(expected);
	// });
});