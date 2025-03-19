import {NodeProps, Handle, Position} from "@xyflow/react";
import {FC} from "react";
import {AgentNode} from "../nodeTypes";
import BaseNode from "./BaseNode";

export type ChatAgentNodeProps = NodeProps<AgentNode<"vectorStore">>;

const VectorStoreNode: FC<ChatAgentNodeProps> = (props) => {
    const {id, data} = props;
    return (
        <>
            <BaseNode {...props} showDeleteButton classNames="rounded-xl py-4 px-24">
                <Handle type="target" position={Position.Left} id={`main-${id}-target`}/>
                <Handle
                    type="target"
                    position={Position.Top}
                    id={`retriever-${id}`}
                    style={{left: "50%"}}
                />
                <span className="absolute text-xs" style={{left: "40%", top: 0}}>
          Retriever
        </span>
            </BaseNode>
        </>
    )

}

export default VectorStoreNode;