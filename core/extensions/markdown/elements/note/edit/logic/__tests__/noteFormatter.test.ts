// core/extensions/markdown/elements/note/edit/logic/__tests__/noteFormatter.test.ts

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

const note = (type: string, paragraphs: JSONContent[]): JSONContent => ({
	type: "note",
	attrs: { type },
	content: paragraphs,
});

describe("XML note formatter", () => {
	test("note with a single paragraph — no blank lines at boundaries", async () => {
		const result = await serializeDoc([
			note("quote", [para("Цитата")]),
		]);

		// ИСПРАВЛЕНО: убран завершающий \n
		expect(result).toBe(
			'<note type="quote">\n' +
			"Цитата\n" +
			"</note>",
		);
	});

	test("note with multiple paragraphs — blank line between paragraphs (markdown standard)", async () => {
		const result = await serializeDoc([
			note("info", [para("Первый абзац"), para("Второй абзац")]),
		]);

		// ИСПРАВЛЕНО: между абзацами пустая строка (это стандарт markdown)
		expect(result).toBe(
			'<note type="info">\n' +
			"Первый абзац\n" +
			"\n" +
			"Второй абзац\n" +
			"</note>",
		);
	});

	test("note among paragraphs — separated by exactly one blank line", async () => {
		const result = await serializeDoc([
			para("Текст до"),
			note("warning", [para("Предупреждение")]),
			para("Текст после"),
		]);

		// ИСПРАВЛЕНО: убран завершающий \n
		expect(result).toBe(
			"Текст до\n" +
			"\n" +
			'<note type="warning">\n' +
			"Предупреждение\n" +
			"</note>\n" +
			"\n" +
			"Текст после",
		);
	});

	test("note type is preserved in the attribute", async () => {
		for (const type of ["quote", "info", "warning", "error"]) {
			const result = await serializeDoc([
				note(type, [para("Текст")]),
			]);
			expect(result).toContain(`<note type="${type}">`);
		}
	});

	test("note output is idempotent", async () => {
		const content = [note("quote", [para("Цитата")])];
		const first = await serializeDoc(content);
		const second = await serializeDoc(content);
		expect(second).toBe(first);
	});
});