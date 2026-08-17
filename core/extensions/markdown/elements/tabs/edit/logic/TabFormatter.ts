import type { FormatterType } from "@ext/markdown/core/edit/logic/Formatter/Formatters/typeFormats/getFormatterType";
import type { NodeSerializerSpec } from "@ext/markdown/core/edit/logic/Prosemirror/to_markdown";

const TabFormatter =
	(formatter: FormatterType): NodeSerializerSpec =>
	async (state, node) => {
		// state.write(
		// 	`${formatter.openTag("tab", {
		// 		name: node.attrs.name,
		// 		icon: node.attrs.icon,
		// 		tag: node.attrs.tag,
		// 	})}\n\n`,
		// );
		// await state.renderContent(node);
		// state.write(formatter.closeTag("tab"));
		// state.closeBlock(node);
		const openTag = formatter.openTag('tab', {
			name: node.attrs.name,
			icon: node.attrs.icon,
			tag: node.attrs.tag,
		});

		if (node.content.size > 0) {
			state.write(openTag + '\n');

			const oldDelim = state.delim;
			state.delim = '  ' + state.delim;

			await state.renderContent(node);

			state.delim = oldDelim;
			state.write('</tab>', 0);
		} else {
			state.write(openTag + '</tab>', 0);
		}

		state.closeBlock(node);
	};

export default TabFormatter;
