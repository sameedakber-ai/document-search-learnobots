import {Node, XYPosition, NodeProps, Handle, Position} from "@xyflow/react";
import {FC, useCallback, useState} from "react";
import {createPortal} from "react-dom";
import ChatModal from "./ChatModal";

export interface ChatProperties {
    generation_model: string;
    temperature: number;
    context: string;
    prompt: string;
    position_x: number;
    position_y: number;
}

export interface NodeData {
    [key: string]: unknown;

    slug: string;
    type: 'chat';
    workflow: string;
    next_agents?: string[];
    memory_node?: string;
    chat_model_node?: string;
    tool_nodes?: string[];
    properties: ChatProperties;
}

export interface ChatAgentNode extends Node {
    id: string;
    type: string;
    position: XYPosition;
    data: NodeData;
}

export type ChatAgentNodeProps = NodeProps<ChatAgentNode>;

const ChatAgent: FC<ChatAgentNodeProps> = ({id, data}) => {
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const handleOpenModal = useCallback((): void => setIsModalOpen(true), []);
    const handleCloseModal = useCallback((): void => setIsModalOpen(false), []);

    return (
        <>
            <div className="relative">
                <Handle type="target" position={Position.Left} id={`main-${id}-target`} />
                <div className="rounded-xl flex justify-center items-center py-4 px-24 border-1">
                    <button onClick={handleOpenModal}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                             stroke="currentColor" className="size-6">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"/>
                        </svg>
                    </button>
                </div>
                <Handle type="source" position={Position.Right} id={`main-${id}-source`} />
                {createPortal(
                    <ChatModal
                        id={id}
                        isOpen={isModalOpen}
                        onClose={handleCloseModal}
                        data={data}
                    />,
                    document.body
                )}
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id={`chatModel-${id}`}
                    style={{left: '20%'}} // positioned at 30% of the node's width
                />
                <span className="absolute text-xs" style={{left: '5%', bottom: 0}}>
                    Chat Model
                </span>

                <Handle
                    type="source"
                    position={Position.Bottom}
                    id={`memory-${id}`}
                    style={{left: '80%'}} // positioned at 70% of the node's width
                />
                <span className="absolute text-xs" style={{left: '70%', bottom: 0}}>
                    Memory
                </span>
                <Handle
                    type="source"
                    position={Position.Bottom}
                    id={`tools-${id}`}
                    style={{left: '50%'}} // positioned at 70% of the node's width
                />
                <span className="absolute text-xs" style={{left: '44%', bottom: 0}}>
                    Tools
                </span>
            </div>
        </>
    )
}

export default ChatAgent;