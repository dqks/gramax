import getNodeFormatters from "@ext/markdown/core/edit/logic/Formatter/Formatters/getNodeFormatters";
import { ProsemirrorMarkdownSerializer } from "@ext/markdown/core/edit/logic/Prosemirror";
import getMarkFormatters from "@ext/markdown/core/edit/logic/Formatter/Formatters/getMarkFormatters";
import { getSchema } from "@ext/markdown/core/edit/logic/Prosemirror/schema";
import type { JSONContent } from "@tiptap/core";
import { Node } from "@tiptap/pm/model";
import { test } from "gray-matter";

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

const tab = (name: string, content: JSONContent[]): JSONContent => ({
    type: "tab",
    attrs: { name },
    content,
});

const tabs = (...tabNodes: JSONContent[]): JSONContent => ({
    type: "tabs",
    content: tabNodes,
});

describe("Nested component indentation", () => {
    test("structural child tags get 2-space indent per level", async () => {
        const result = await serializeDoc([
            tabs(tab("Первый вариант", [para("Текст вкладки.")])),
        ]);

        expect(result).toBe(
            "<tabs>\n" +
            '  <tab name="Первый вариант">\n' +
            "    Текст вкладки.\n" +
            "  </tab>\n" +
            "</tabs>",
        );
    });

    test("each nesting level adds exactly 2 spaces", async () => {
        const result = await serializeDoc([
            tabs(tab("Вкладка", [para("Текст.")])),
        ]);

        const lines = result.split("\n");

        expect(lines[0]).toBe("<tabs>");
        expect(lines[1]).toMatch(/^ {2}<tab /);
        expect(lines[2]).toMatch(/^ {4}Текст\.$/);
        expect(lines[3]).toMatch(/^ {2}<\/tab>$/);
        expect(lines[4]).toBe("</tabs>");
    });

    test("multiple tabs each get proper indentation", async () => {
        const result = await serializeDoc([
            tabs(
                tab("Первый вариант", [para("Текст первой вкладки.")]),
                tab("Второй вариант", [para("Текст второй вкладки.")]),
            ),
        ]);

        expect(result).toBe(
            "<tabs>\n" +
            '  <tab name="Первый вариант">\n' +
            "    Текст первой вкладки.\n" +
            "  </tab>\n" +
            "\n" +
            '  <tab name="Второй вариант">\n' +
            "    Текст второй вкладки.\n" +
            "  </tab>\n" +
            "</tabs>",
        );
    });

    test("tab with multiple paragraphs keeps indent for each", async () => {
        const result = await serializeDoc([
            tabs(tab("Вкладка", [para("Первый абзац."), para("Второй абзац.")])),
        ]);

        const lines = result.split("\n");
        const firstPara = lines.find((l) => l.includes("Первый абзац."));
        const secondPara = lines.find((l) => l.includes("Второй абзац."));

        expect(firstPara).toMatch(/^ {4}Первый абзац\.$/);
        expect(secondPara).toMatch(/^ {4}Второй абзац\.$/);
    });

    test("list inside tab preserves relative indentation", async () => {
        const result = await serializeDoc([
            tabs(tab("Вкладка", [
                {
                    type: "bulletList",
                    content: [
                        { type: "listItem", content: [para("пункт 1")] },
                        { type: "listItem", content: [para("пункт 2")] },
                    ],
                },
            ])),
        ]);

        const lines = result.split("\n");
        const item1 = lines.find((l) => l.includes("пункт 1"));
        const item2 = lines.find((l) => l.includes("пункт 2"));

        expect(item1).toBeDefined();
        expect(item2).toBeDefined();
        expect(item1).toMatch(/^ {4}-  пункт 1$/);
        expect(item2).toMatch(/^ {4}-  пункт 2$/);
    });

    test("nested list inside tab preserves relative sub-list indentation", async () => {
        const result = await serializeDoc([
            tabs(
                tab("Вкладка", [
                    {
                        type: "bulletList",
                        content: [
                            {
                                type: "listItem",
                                content: [
                                    para("родитель"),
                                    {
                                        type: "bulletList",
                                        content: [
                                            { type: "listItem", content: [para("ребёнок")] },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ]),
            ),
        ]);

        const lines = result.split("\n");
        const parent = lines.find((l) => l.includes("родитель"));
        const child = lines.find((l) => l.includes("ребёнок"));

        expect(parent).toBeDefined();
        expect(child).toBeDefined();
        const parentIndent = parent?.match(/^ */)?.[0].length ?? 0;
        const childIndent = child?.match(/^ */)?.[0].length ?? 0;
        expect(childIndent - parentIndent).toBe(3);
    });

    test("code block inside tab preserves its content without extra indent", async () => {
        const result = await serializeDoc([
            tabs(
                tab("Вкладка", [
                    {
                        type: "code_block",
                        attrs: { language: null },
                        content: [{ type: "text", text: "const x = 1;" }],
                    },
                ]),
            ),
        ]);

        const lines = result.split("\n");
        const codeLine = lines.find((l) => l.includes("const x = 1;"));

        expect(codeLine).toBeDefined();
    });

    test("nested component output is idempotent", async () => {
        const content = [tabs(tab("Вкладка", [para("Текст.")]))];
        const first = await serializeDoc(content);
        const second = await serializeDoc(content);
        expect(second).toBe(first);
    });

    test("example from requirements", async () => {
        const result = await serializeDoc([
            tabs(tab("Первый вариант", [para("Текст вкладки.")])),
        ]);

        expect(result).toBe(
            "<tabs>\n" +
            '  <tab name="Первый вариант">\n' +
            "    Текст вкладки.\n" +
            "  </tab>\n" +
            "</tabs>",
        );
    });
});