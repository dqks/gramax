import type { Schema } from "../render/logic/Markdoc";

export const getContainerTags = (tags: Record<string, Schema>): Set<string> => {
    return new Set(
        Object.entries(tags)
        .filter(([, schema]) => schema?.selfClosing === false)
        .map(([name]) => name),
    );
};

const computeMinIndent = (lines: string[]): number => {
    let min = Infinity;
    for (const line of lines) {
        if (line.trim() === "") continue;
        const indent = line.length - line.trimStart().length;
        if (indent < min) min = indent;
    }
    return min === Infinity ? 0 : min;
};

interface TagInfo {
    tagName: string;
    isOpen: boolean;
    isClose: boolean;
    selfClosing: boolean;
}

const XML_TAG_RE = /^(\s*)<(\/?)([a-zA-Z0-9_-]+)([^>]*)>\s*$/;
const CURLY_TAG_RE = /^(\s*)\{%\s*(\/?)\s*([a-zA-Z0-9_-]+)([\s\S]*?)\s*%\}\s*$/;

const getTagInfo = (line: string): TagInfo | null => {
    const xml = line.match(XML_TAG_RE);
    if (xml) {
        const [, , slash, tagName, rest] = xml;
        const selfClosing = /\/\s*>$/.test(line.trim()) || rest.trim().startsWith("/");
        return {
            tagName,
            isOpen: !slash && !selfClosing,
            isClose: slash === "/",
            selfClosing,
        };
    }

    const curly = line.match(CURLY_TAG_RE);
    if (curly) {
        const [, , slash, tagName, rest] = curly;
        const selfClosing = /\/\s*%\}\s*$/.test(line.trim()) || rest.trim().startsWith("/");
        return {
            tagName,
            isOpen: !slash && !selfClosing,
            isClose: slash === "/",
            selfClosing,
        };
    }

    return null;
};


export const dedentContainerContent = (content: string, containerTags: Set<string>): string => {
    const lines = content.split("\n");
    const result: string[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const info = getTagInfo(line);

        if (info?.isOpen && containerTags.has(info.tagName)) {

            let depth = 1;
            let j = i + 1;
            let closeIndex = -1;
            while (j < lines.length && depth > 0) {
                const tagInfo = getTagInfo(lines[j]);
                if (tagInfo && containerTags.has(tagInfo.tagName)) {
                    if (tagInfo.isClose) depth--;
                    else if (tagInfo.isOpen) depth++;
                }
                j++;
            }
            closeIndex = j - 1;

            if (closeIndex < lines.length) {
                const contentLines = lines.slice(i + 1, closeIndex);
                const minIndent = computeMinIndent(contentLines);
                const dedentedLines = contentLines.map((l) => (l.trim() === "" ? l : l.slice(minIndent)));
                const dedentedContent = dedentContainerContent(dedentedLines.join("\n"), containerTags);

                result.push(line);
                result.push(...dedentedContent.split("\n"));
                result.push(lines[closeIndex]);
                i = closeIndex + 1;
                continue;
            }
        }

        result.push(line);
        i++;
    }

    return result.join("\n");
};

