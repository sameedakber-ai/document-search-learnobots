import {Handle, NodeProps, Position} from "@xyflow/react";
import {FC} from "react";

import {AgentNode} from "../nodeTypes";
import BaseNode from "./BaseNode";

export type MemoryNodeProps = NodeProps<AgentNode<"memory">>;

const MemoryNode: FC<MemoryNodeProps> = (props) => {
    const { id }  = props;

    return (
        <BaseNode {...props} classNames='rounded-2xl p-4'>
            <Handle
                type="target"
                position={Position.Top}
                id={`memory-${id}`}
            />
        </BaseNode>
    );
}

export default MemoryNode;