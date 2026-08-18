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

const heading = (text: string, level: number): JSONContent => ({
	type: "heading",
	attrs: { level },
	content: text ? [{ type: "text", text }] : [],
});

const bulletList = (...items: JSONContent[]): JSONContent => ({
	type: "bulletList",
	attrs: { tight: true, containTaskList: false },
	content: items,
});

const listItem = (text: string): JSONContent => ({
	type: "listItem",
	content: [para(text)],
});


describe("Heading spacing", () => {
	test("one blank line between paragraph and heading", async () => {
		const result = await serializeDoc([
			para("Текст перед."),
			heading("Заголовок", 2),
		]);

		expect(result).toBe("Текст перед.\n\n## Заголовок");
		expect(result).not.toContain("\n\n\n");
	});

	test("one blank line between heading and paragraph", async () => {
		const result = await serializeDoc([
			heading("Заголовок", 2),
			para("Текст после."),
		]);

		expect(result).toBe("## Заголовок\n\nТекст после.");
		expect(result).not.toContain("\n\n\n");
	});

	test("one blank line between two consecutive headings of same level", async () => {
		const result = await serializeDoc([
			heading("Первый", 2),
			heading("Второй", 2),
		]);

		expect(result).toBe("## Первый\n\n## Второй");
		expect(result).not.toContain("\n\n\n");
	});

	test("one blank line between consecutive headings of different levels", async () => {
		const result = await serializeDoc([
			heading("Большой", 1),
			heading("Поменьше", 3),
		]);

		expect(result).toBe("# Большой\n\n### Поменьше");
		expect(result).not.toContain("\n\n\n");
	});

	test("three consecutive headings each separated by exactly one blank line", async () => {
		const result = await serializeDoc([
			heading("Первый", 1),
			heading("Второй", 2),
			heading("Третий", 3),
		]);

		const expected =
			"# Первый\n" +
			"\n" +
			"## Второй\n" +
			"\n" +
			"### Третий";

		expect(result).toBe(expected);
		expect(result).not.toContain("\n\n\n");
	});

	test("heading at document start has no leading blank line", async () => {
		const result = await serializeDoc([
			heading("Начало", 1),
			para("Текст."),
		]);

		expect(result).toBe("# Начало\n\nТекст.");
		expect(result).not.toMatch(/^\n/);
	});

	test("one blank line between list and heading", async () => {
		const result = await serializeDoc([
			bulletList(listItem("пункт 1"), listItem("пункт 2")),
			heading("Заголовок", 2),
		]);

		expect(result).toContain("\n\n## Заголовок");
		expect(result).not.toContain("\n\n\n");
	});

	test("one blank line between heading and list", async () => {
		const result = await serializeDoc([
			heading("Заголовок", 2),
			bulletList(listItem("пункт 1"), listItem("пункт 2")),
		]);

		expect(result).toContain("## Заголовок\n\n- ");
		expect(result).not.toContain("\n\n\n");
	});

	test("heading between two paragraphs has one blank line on each side", async () => {
		const result = await serializeDoc([
			para("До."),
			heading("Между", 2),
			para("После."),
		]);

		expect(result).toBe("До.\n\n## Между\n\nПосле.");
		expect(result).not.toContain("\n\n\n");
	});

	const levels = [1, 2, 3, 4, 5, 6];
	for (const level of levels) {
		test(`heading level ${level} has correct spacing`, async () => {
			const result = await serializeDoc([
				para("До."),
				heading(`Заголовок уровня ${level}`, level),
				para("После."),
			]);

			const hashes = "#".repeat(level);
			expect(result).toBe(`До.\n\n${hashes} Заголовок уровня ${level}\n\nПосле.`);
		});
	}

	test("heading spacing is idempotent", async () => {
		const content = [
			para("До."),
			heading("Первый", 1),
			heading("Второй", 2),
			para("После."),
		];

		const first = await serializeDoc(content);
		const second = await serializeDoc(content);
		expect(second).toBe(first);
	});

	test("no double blank lines anywhere in document with headings", async () => {
		const result = await serializeDoc([
			para("Абзац 1."),
			heading("Заголовок 1", 1),
			heading("Заголовок 2", 2),
			bulletList(listItem("пункт"), listItem("пункт")),
			heading("Заголовок 3", 3),
			para("Абзац 2."),
		]);

		expect(result).not.toContain("\n\n\n");
	});

	test("heading with inline formatting keeps correct spacing", async () => {
		const result = await serializeDoc([
			para("До."),
			{
				type: "heading",
				attrs: { level: 2 },
				content: [
					{ type: "text", text: "Заголовок с " },
					{
						type: "text",
						text: "жирным",
						marks: [{ type: "strong" }],
					},
				],
			},
			para("После."),
		]);

		expect(result).toContain("\n\n## ");
		expect(result).not.toContain("\n\n\n");
	});
});