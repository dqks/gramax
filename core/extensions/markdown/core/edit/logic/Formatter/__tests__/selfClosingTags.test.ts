// core/extensions/markdown/core/edit/logic/Formatter/__tests__/selfClosingTags.test.ts

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

// --- Хелперы ---

const icon = (code: string): JSONContent => ({
	type: "icon",
	attrs: { code },
});

const para = (...inlineContent: JSONContent[]): JSONContent => ({
	type: "paragraph",
	content: inlineContent.length ? inlineContent : [],
});

const text = (t: string): JSONContent => ({ type: "text", text: t });

const cell = (content: JSONContent[]): JSONContent => ({
	type: "tableCell",
	attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null },
	content,
});

const row = (cells: JSONContent[]): JSONContent => ({
	type: "tableRow",
	content: cells,
});

const table = (rows: JSONContent[]): JSONContent => ({
	type: "table",
	attrs: { header: "row" },
	content: rows,
});

// ============================================================
// Тесты: Самозакрывающиеся теги
// ============================================================

describe("XML self-closing tags", () => {
	test("icon renders as self-closing with space before />", async () => {
		const result = await serializeDoc([
			para(text("Текст "), icon("sparkles"), text(" после")),
		]);

		expect(result).toContain('<icon code="sparkles" />');
		expect(result).not.toMatch(/sparkles"\/>/);
	});

	const iconCodes = ["sparkles", "arrow-up-1-0", "at-sign"];
	for (const code of iconCodes) {
		test(`icon code="${code}" has space before />`, async () => {
			const result = await serializeDoc([para(icon(code))]);
			expect(result).toContain(`<icon code="${code}" />`);
		});
	}

	test("multiple icons in one paragraph each keeps space before />", async () => {
		const result = await serializeDoc([
			para(text("до "), icon("sparkles"), text(" между "), icon("at-sign"), text(" после")),
		]);

		expect(result).toContain('<icon code="sparkles" />');
		expect(result).toContain('<icon code="at-sign" />');
	});

	test("icon output is idempotent", async () => {
		const content = [para(icon("sparkles"))];
		const first = await serializeDoc(content);
		const second = await serializeDoc(content);
		expect(second).toBe(first);
	});

	test("col with width renders as self-closing with space before /> inside table", async () => {
		const headerCell = cell([para(text("Широкий"))]);
		headerCell.attrs = { ...headerCell.attrs, colwidth: [180] };

		const result = await serializeDoc([
			table([
				row([headerCell, cell([para(text("Узкий"))])]),
			]),
		]);

		expect(result).toContain('<col width="180" />');
		expect(result).not.toMatch(/180"\/>/);
	});

	test("document contains NO self-closing tags without space before />", async () => {
		const headerCell = cell([para(icon("sparkles"))]);
		headerCell.attrs = { ...headerCell.attrs, colwidth: [180] };

		const result = await serializeDoc([
			table([
				row([headerCell, cell([para(text("текст"))])]),
			]),
		]);

		const selfClosingWithoutSpace = result.match(/"[^"]*"\/>/g) ?? [];
		expect(selfClosingWithoutSpace).toEqual([]);
	});
});