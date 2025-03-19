import {Node, XYPosition} from "@xyflow/react";

export interface FileType {
    id: string;
    extension: string;
    name: string;
    date: string;
}

export interface AgentBase {
    [key: string]: unknown;

    slug: string;
    type: 'documentLoader' | 'chat' | 'chatTrigger' | 'memory' | 'chatModel' | 'vectorStore';
    workflow?: string;
    next_agents?: string[];
    memory_node?: string;
    chat_model_node?: string;
    tool_nodes?: string[];
    status: string;
    onDelete: (id: string) => void;
    flowType: string;
}

export interface ChatTriggerNodeBase extends AgentBase {
    onOpenChat: (nodeId: string) => void;
}

export interface DocumentLoaderBase extends AgentBase {
    onRun: (nodeId: string) => void;
    onFilesUpdate: (nodeId: string) => void;
}

export interface DocumentLoaderAgent extends DocumentLoaderBase {
    type: 'documentLoader';
    properties: DocumentLoaderProperties;
}

export interface AskAIAgent extends AgentBase {
    type: 'chat';
    properties: AskAIProperties;
}

export interface ChatTriggerAgent extends ChatTriggerNodeBase {
    type: 'chatTrigger';
    properties: ChatTriggerProperties;
}

export interface MemoryAgent extends AgentBase {
    type: 'memory';
    properties: MemoryNodeProperties;
}

export interface ChatModelAgent extends AgentBase {
    type: 'chatModel';
    properties: ChatModelNodeProperties;
}

export interface VectorStoreNode extends AgentBase {
    type: 'vectorStore';
    properties: VectorStoreProperties;
}

export interface DocumentLoaderProperties {
    files: FileType[];
    embedding_model: string;
    position_x: number;
    position_y: number;
}

export interface AskAIProperties {
    generation_model: string;
    temperature: number;
    context: string;
    prompt: string;
    position_x: number;
    position_y: number;
}

export interface ChatTriggerProperties {
    position_x: number;
    position_y: number;
    memories?: MemoryItem[];
}

export interface VectorStoreProperties {
    position_x: number;
    position_y: number;
}

export interface MemoryContent {
    type: string;
    text: string;
}

export interface MemoryItem {
    role: string;
    content: MemoryContent[];
}

export interface MemoryNodeProperties {
    position_x: number;
    position_y: number;
    memories?: MemoryItem[];
}

export interface ChatModelNodeProperties {
    position_x: number;
    position_y: number;
    service: string;
    model: string;
}

type NodeDataMapping = {
    documentLoader: DocumentLoaderAgent;
    chat: AskAIAgent;
    chatTrigger: ChatTriggerAgent;
    memory: MemoryAgent;
    chatModel: ChatModelAgent;
    vectorStore: VectorStoreNode;
};


export interface AgentNode<T extends keyof NodeDataMapping = keyof NodeDataMapping> extends Node {
    id: string;
    type: T;
    data: NodeDataMapping[T];
    position: XYPosition;
}

export type AgentData = AgentNode['data'];

export function isAgentNodeOfType<T extends keyof NodeDataMapping>(
    node: AgentNode,
    type: T
): node is AgentNode<T> {
    return node.type === type;
}

export type FlowType = "main" | "trigger" | "sub" | "tool";

export function getFlowType(nodeType: string): FlowType {
    const mapping: Record<string, FlowType> = {
        chat: "main",
        chatTrigger: "trigger",
        memory: "sub",
        documentLoader: "trigger",
        chatModel: "sub",
        vectorStore: "tool"
    };

    return mapping[nodeType] || "main";
}


export default AgentNode;