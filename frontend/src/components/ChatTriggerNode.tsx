import {NodeProps, Handle, Position} from "@xyflow/react";
import {FC} from "react";
import {AgentNode} from "../nodeTypes";
import BaseNode from "./BaseNode";

export type ChatTriggerNodeProps = NodeProps<AgentNode<"chatTrigger">>;

const ChatTriggerNode: FC<ChatTriggerNodeProps> = (props) => {
    const { id } = props;
    return (
        <BaseNode {...props} classNames='rounded-l-2xl p-4'>
            <div
                className="z-50 absolute -left-5 top-5"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="red"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="size-5"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
                    />
                </svg>
            </div>
            <Handle type="source" id={`main-${id}`} position={Position.Right}/>
        </BaseNode>
    );
};

export default ChatTriggerNode;
