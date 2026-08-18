import type { NodeSerializerSpec } from "@ext/markdown/core/edit/logic/Prosemirror/to_markdown";

const orderedList: NodeSerializerSpec = async (state, node) => {
	const indent = node.attrs.tight ? "  " : "    ";
	const start = node.attrs.order || 1;
	
	await state.renderList(
		node,
		() => indent,
		(i) => `${start + i}. `,
	);
};

export default orderedList;
