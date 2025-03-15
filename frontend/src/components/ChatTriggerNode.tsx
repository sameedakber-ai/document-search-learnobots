import {Node, XYPosition, NodeProps, Handle, Position} from "@xyflow/react";
import {FC, useCallback, useState} from "react";

export interface MemoryContent {
    type: string;
    text: string;
}

export interface MemoryItem {
    role: string;
    content: MemoryContent[];
}

export interface NodeProperties {
    position_x: number;
    position_y: number;
    memories?: MemoryItem[];
}

export interface NodeData {
    [key: string]: unknown;
    slug: string;
    type: 'chat';
    workflow: string;
    next_agents?: string[];
    properties: NodeProperties;
    onOpenChat: (nodeId: string) => void;
}

export interface ChatTriggerNode extends Node {
    id: string;
    type: string;
    position: XYPosition;
    data: NodeData;
}

export type ChatAgentNodeProps = NodeProps<ChatTriggerNode>;

const ChatTriggerNode: FC<ChatAgentNodeProps> = ({id, data}) => {
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const handleOpenModal = useCallback((): void => setIsModalOpen(true), []);
    const handleCloseModal = useCallback((): void => setIsModalOpen(false), []);

    return (
        <>
            <div className="relative">
                <button className="z-50 absolute -left-5 top-5" onClick={() => data.onOpenChat(id)}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="red" viewBox="0 0 24 24" stroke-width="1.5"
                         stroke="currentColor" className="size-5">
                        <path stroke-linecap="round" stroke-linejoin="round"
                              d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"/>
                    </svg>
                </button>
                <div className="rounded-l-2xl flex justify-center items-center p-4 border-1">
                    <button onClick={handleOpenModal}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                             stroke="currentColor" className="size-6">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 0 1-.825-.242m9.345-8.334a2.126 2.126 0 0 0-.476-.095 48.64 48.64 0 0 0-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0 0 11.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"/>
                        </svg>
                    </button>
                </div>
                <Handle type="source" id={`main-${id}`} position={Position.Right}/>
            </div>
        </>
    )
}

export default ChatTriggerNode;