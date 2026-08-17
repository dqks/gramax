// core/extensions/markdown/core/edit/logic/Formatter/__tests__/tableResize.unit.test.ts

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

const simpleCell = (text: string, attrs: Record<string, any> = {}): JSONContent => ({
    type: "tableCell_simple",
    attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null, isCustomWidth: false, ...attrs },
    content: text ? [{ type: "text", text }] : [],
});

const headerCell = (text: string, attrs: Record<string, any> = {}): JSONContent => ({
    type: "tableHeader_simple",
    attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null, isCustomWidth: false, ...attrs },
    content: text ? [{ type: "text", text }] : [],
});

const headerCellWithWidth = (text: string, width: number, attrs: Record<string, any> = {}): JSONContent =>
    headerCell(text, { colwidth: [width], isCustomWidth: true, ...attrs });

const headerRow = (cells: JSONContent[]): JSONContent => ({
    type: "tableHeaderRow_simple",
    content: cells,
});

const bodyRow = (cells: JSONContent[]): JSONContent => ({
    type: "tableBodyRow_simple",
    content: cells,
});

const mdTable = (header: JSONContent, body: JSONContent[]): JSONContent => ({
    type: "table_simple",
    attrs: { header: "row" },
    content: [header, ...body],
});

// ============================================================
// Тесты: Ресайз Markdown-таблицы
// ============================================================

describe("Table resize attributes", () => {
    // --- Атрибут {width=Npx} в заголовке ---

    test("colwidth with isCustomWidth renders as {width=Npx} attribute", async () => {
        const result = await serializeDoc([
            mdTable(
                headerRow([
                    headerCellWithWidth("Элемент", 180),
                    headerCellWithWidth("Значение", 220),
                    headerCell("Комментарий"),
                ]),
                [bodyRow([simpleCell("Ссылка"), simpleCell("Да"), simpleCell("Относительная")])],
            ),
        ]);

        expect(result).toContain("| Элемент {width=180px} |");
        expect(result).toContain("| Значение {width=220px} |");
        expect(result).toContain("| Комментарий |");
        expect(result).not.toMatch(/Комментарий \{width=/);
    });

    // --- Таблица остаётся в Markdown-формате ---

    test("table with colwidth stays in pipe format (NOT XML)", async () => {
        const result = await serializeDoc([
            mdTable(
                headerRow([
                    headerCellWithWidth("Широкий", 300),
                    headerCellWithWidth("Узкий", 100),
                ]),
                [bodyRow([simpleCell("а"), simpleCell("б")])],
            ),
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
            mdTable(
                headerRow([headerCellWithWidth("Название", 200)]),
                [bodyRow([simpleCell("Текст")])],
            ),
        ]);

        expect(result).toMatch(/Название \{width=200px\} \|/);
        expect(result).not.toMatch(/\{width=200px\} Название/);
    });

    // --- Автоматическая ширина не записывается ---

    test("automatic width (no colwidth) does not add {width=auto} attribute", async () => {
        const result = await serializeDoc([
            mdTable(
                headerRow([
                    headerCell("Без ширины"),
                    headerCellWithWidth("С шириной", 150),
                ]),
                [bodyRow([simpleCell("а"), simpleCell("б")])],
            ),
        ]);

        expect(result).toContain("| Без ширины |");
        expect(result).not.toMatch(/Без ширины \{width=/);
        expect(result).toContain("| С шириной {width=150px} |");
    });

    // --- Множественные атрибуты ---

    test("multiple attributes are separated by space, not comma", async () => {
        const result = await serializeDoc([
            mdTable(
                headerRow([headerCellWithWidth("Элемент", 180)]),
                [bodyRow([simpleCell("Текст")])],
            ),
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
            mdTable(
                headerRow([
                    headerCellWithWidth("Колонка 1", 200),
                    headerCellWithWidth("Колонка 2", 300),
                ]),
                [
                    bodyRow([simpleCell("Данные 1"), simpleCell("Данные 2")]),
                    bodyRow([simpleCell("Ещё данные"), simpleCell("Ещё")]),
                ],
            ),
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
            mdTable(
                headerRow([
                    headerCellWithWidth("Элемент", 180),
                    headerCellWithWidth("Значение", 220),
                ]),
                [bodyRow([simpleCell("Ссылка"), simpleCell("Да")])],
            ),
        ];

        const first = await serializeDoc(content);
        const second = await serializeDoc(content);
        expect(second).toBe(first);
    });

    // --- Пример из требования ---

    test("example from requirements", async () => {
        const result = await serializeDoc([
            mdTable(
                headerRow([
                    headerCellWithWidth("Элемент", 180),
                    headerCellWithWidth("Значение", 220),
                    headerCell("Комментарий"),
                ]),
                [bodyRow([simpleCell("Ссылка"), simpleCell("Да"), simpleCell("Относительная")])],
            ),
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

    test("alignment markers are preserved with width attributes", async () => {
        const result = await serializeDoc([
            mdTable(
                headerRow([
                    headerCellWithWidth("Лево", 150, { align: "left" }),
                    headerCellWithWidth("Центр", 200, { align: "center" }),
                    headerCellWithWidth("Право", 250, { align: "right" }),
                ]),
                [bodyRow([simpleCell("а"), simpleCell("б"), simpleCell("в")])],
            ),
        ]);

        expect(result).toContain("Лево {width=150px}");
        expect(result).toContain("Центр {width=200px}");
        expect(result).toContain("Право {width=250px}");
        expect(result).toContain(":---");
        expect(result).toContain(":---:");
        expect(result).toContain("---:");
    });

    // --- Флаг isCustomWidth ---

    test("colwidth without isCustomWidth=true does NOT add {width=Npx} attribute", async () => {
        const result = await serializeDoc([
            mdTable(
                headerRow([
                    headerCell("Колонка", { colwidth: [200], isCustomWidth: false }),
                ]),
                [bodyRow([simpleCell("Текст")])],
            ),
        ]);

        expect(result).toContain("| Колонка |");
        expect(result).not.toMatch(/Колонка \{width=/);
    });

    test("isCustomWidth=true without colwidth does NOT add {width=Npx} attribute", async () => {
        const result = await serializeDoc([
            mdTable(
                headerRow([
                    headerCell("Колонка", { isCustomWidth: true }),
                ]),
                [bodyRow([simpleCell("Текст")])],
            ),
        ]);

        expect(result).toContain("| Колонка |");
        expect(result).not.toMatch(/Колонка \{width=/);
    });
});