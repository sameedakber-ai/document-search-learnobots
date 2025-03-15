import {Handle, Node, NodeProps, Position, XYPosition} from "@xyflow/react";
import {FC} from "react";


export interface NodeProperties {
    position_x: number;
    position_y: number;
}

export interface NodeData {
    [key: string]: unknown;
    slug: string;
    type: 'memory';
    workflow: string;
    next_agents?: string[];
    properties: NodeProperties;
}

export interface MemoryNode extends Node {
    id: string;
    type: string;
    position: XYPosition;
    data: NodeData;
}

export type MemoryNodeProps = NodeProps<MemoryNode>;

const MemoryNode: FC<MemoryNodeProps> = ({id, data}) => {
    return (
        <>
            <div className="relative">
                <Handle type="target" position={Position.Top} id={`memory-${id}`} />
                <div className="rounded-full flex justify-center items-center p-4 border-1">
                    <button>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                             stroke="currentColor" className="size-4">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"/>
                        </svg>

                    </button>
                </div>
            </div>
        </>
    )
}

export default MemoryNode;