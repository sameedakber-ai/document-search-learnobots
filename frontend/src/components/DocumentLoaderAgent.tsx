import {NodeProps, Position, Handle} from "@xyflow/react";
import {FC} from "react";

import {AgentNode} from "../nodeTypes";
import BaseNode from "./BaseNode";

export type DocumentLoaderAgentNodeProps = NodeProps<AgentNode<"documentLoader">>;

const DocumentLoaderAgent: FC<DocumentLoaderAgentNodeProps> = (props) => {
    const {id, data} = props;

    return (
         <BaseNode {...props} classNames="rounded-2xl p-4">
            <Handle
                type="target"
                position={Position.Left}
                id={`main-${id}-target`}
            />
            <Handle
                type="source"
                position={Position.Right}
                id={`main-${id}-source`}
            />
        </BaseNode>
    )

}

export default DocumentLoaderAgent;



