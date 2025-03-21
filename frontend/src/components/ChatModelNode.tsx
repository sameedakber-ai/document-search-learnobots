import {Handle, NodeProps, Position} from "@xyflow/react";
import {FC} from "react";

import {AgentNode} from "../nodeTypes";
import BaseNode from "./BaseNode";

export type ChatModelNodeProps = NodeProps<AgentNode<"chatModel">>;

const ChatModelNode: FC<ChatModelNodeProps> = (props) => {
    const { id } = props;
    return (
        <BaseNode {...props} classNames="rounded-2xl p-4">
            <Handle
                type="target"
                id={`chatModel-${id}`}
                position={Position.Top}
            />
        </BaseNode>
    )
}

export default ChatModelNode;