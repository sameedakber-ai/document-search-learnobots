import { NodeProps, Position, Handle } from "@xyflow/react";
import { FC } from "react";

import { AgentNode } from "../nodeTypes";
import BaseNode from "./BaseNode";

export type DocumentLoaderAgentNodeProps = NodeProps<AgentNode<"documentLoader">>;

const DocumentLoaderAgent: FC<DocumentLoaderAgentNodeProps> = (props) => {
    const { id } = props;
    return (
        <BaseNode {...props} classNames="rounded-l-2xl p-4">
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
                        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                    />
                </svg>
            </div>
            <Handle
                type="source"
                position={Position.Right}
                id={`main-${id}-source`}
            />
        </BaseNode>
    );
};

export default DocumentLoaderAgent;