import {NodeProps, Handle, Position} from "@xyflow/react";
import {FC} from "react";
import {AgentNode} from "../nodeTypes";
import BaseNode from "./BaseNode";

export type ChatAgentNodeProps = NodeProps<AgentNode<"chat">>;

const ChatAgent: FC<ChatAgentNodeProps> = (props) => {
    const { id, data } = props;
    return (
        <>
            <BaseNode {...props} showDeleteButton classNames="rounded-xl py-4 px-24">
                <Handle type="target" position={Position.Left} id={`main-${id}-target`}/>
                <Handle type="source" position={Position.Right} id={`main-${id}-source`}/>
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id={`chatModel-${id}`}
                    style={{left: "20%"}}
                />
                <span className="absolute text-xs" style={{left: "5%", bottom: 0}}>
          Chat Model
        </span>
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id={`memory-${id}`}
                    style={{left: "80%"}}
                />
                <span className="absolute text-xs" style={{left: "70%", bottom: 0}}>
          Memory
        </span>
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id={`retriever-${id}`}
                    style={{left: "50%"}}
                />
                <span className="absolute text-xs" style={{left: "39%", bottom: 0}}>
          Retriever
        </span>
            </BaseNode>
        </>
    );
};

export default ChatAgent;
