import type { NodeSerializerSpec } from "@ext/markdown/core/edit/logic/Prosemirror/to_markdown";

const bulletList: NodeSerializerSpec = async (state, node) => {
	const indent = node.attrs.tight ? "  " : "   ";
	
	await state.renderList(
		node,
		() => indent,
		() => (node.attrs.bullet || "-") + " ",
	);
};

export default bulletList;
