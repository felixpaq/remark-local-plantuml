import { Code, Root } from "mdast";
import { visit } from "unist-util-visit";
import { Parent, Node } from "unist";
import plantuml from "node-plantuml-back";

export type NodeInfo = {
  node: Node
  parent?: Parent
}

const collapsePrefixNode = {
  type:'html',
  value:'<details>\n' +
    '  <summary>View source</summary>'
}

const collapseSuffixNode = {
  type:'html',
  value:'</details>'
}

const injectNodesInParent = (parent: Parent, index: number, nodes: Node[]) => {
  parent.children.splice(index, 1, ...nodes);
}

const remarkLocalPlantuml = () => {
  return async (tree: Root) => {
    const nodesInfos: NodeInfo[] = [];

    visit(tree, "code", (node, _index, parent) => {

      let { lang, value } = node;
      if (lang && value && lang === "plantuml") {
        nodesInfos.push({
          node,
          parent
        });
      }
    });

    let promises = [];
    for (const nodeInfo of nodesInfos) {
      const {node, parent} = nodeInfo;

      if(!parent){
        return;
      }

      const { value} = node as Code;
      let svgString = "";
      const plantumlGenerator = plantuml.generate(value, { format: "svg" });

      const promise = new Promise<void>(resolve => {
        plantumlGenerator.out.on("data", (data: Buffer) => {
          svgString += data.toString("utf8");
        });

        plantumlGenerator.out.on("end", () => {

          const newNode = {
            type:'html',
            value: `<div class="plantuml-diagram">${svgString}</div>`
          }

          const nodes = [
            newNode,
            collapsePrefixNode,
            node,
            collapseSuffixNode,
          ];

          const nodeIndex = parent?.children.indexOf(node) ?? 0;

          injectNodesInParent(parent, nodeIndex, nodes);

          resolve();
        });
      });
      promises.push(promise);
    }

    await Promise.all(promises);
  }
}

export default remarkLocalPlantuml;