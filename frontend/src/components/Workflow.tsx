import React, {ChangeEvent, FormEvent, useCallback, useEffect, useState} from "react";
import {useParams} from "react-router-dom";
import api from "../api";

import {useFuzzySearchList, Highlight} from '@nozbe/microfuzz/react'

import {
    ReactFlowProvider,
    ReactFlow,
    useNodesState,
    useEdgesState,
    addEdge,
    Node,
    Edge,
    XYPosition, Controls, MiniMap, Background,
} from '@xyflow/react';
import DocumentUploaderNode from "./DocumentUploaderNode.tsx";
import DocumentLoaderAgent from "./DocumentLoaderAgent.tsx";
import AskAINode from "./AskAINode.tsx";
import {v4 as uuidv4} from "uuid";
import '@xyflow/react/dist/style.css';
import ChatAgent from "./ChatAgent.tsx";
import DefaultPlusEdge from "./DefaultPlusEdge.tsx";
import ChatTriggerNode from "./ChatTriggerNode.tsx";
import MemoryNode from "./MemoryNode.tsx";
import ChatModelNode from "./ChatModelNode.tsx";

const nodeTypes = {
    documentLoader: DocumentLoaderAgent,
    chat: ChatAgent,
    chatTrigger: ChatTriggerNode,
    memory: MemoryNode,
    chatModel: ChatModelNode
};

const edgeTypes = {defaultPlus: DefaultPlusEdge};

export interface OnConnectParams {
    source: string;
    target: string;
}

export interface FileType {
    id: string;
    extension: string;
    name: string;
    date: string;
}

export interface AgentBase {
    [key: string]: unknown;

    slug: string;
    type: 'documentLoader' | 'chat' | 'chatTrigger' | 'memory' | 'chatModel';
    workflow?: string;
    next_agents?: string[];
    memory_node?: string;
    chat_model_node?: string;
    tool_nodes?: string[];
}

export interface ChatTriggerNodeBase extends AgentBase {
    onOpenChat?: (nodeId: string) => void;
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

export interface DocumentLoaderAgent extends AgentBase {
    type: 'documentLoader';
    properties: DocumentLoaderProperties;
}

export interface AskAIAgent extends AgentBase {
    type: 'chat';
    properties: AskAIProperties;
}

export interface ChatTrigger extends ChatTriggerNodeBase {
    type: 'chatTrigger',
    properties: ChatTriggerProperties
}

export interface Memory extends AgentBase {
    type: 'memory',
    properties: MemoryNodeProperties
}

export interface ChatModel extends AgentBase {
    type: 'chatModel',
    properties: ChatModelNodeProperties
}


export type AgentData = DocumentLoaderAgent | AskAIAgent | ChatTrigger | Memory | ChatModel;

export interface AgentNode extends Node {
    id: string;
    type: string;
    data: AgentData;
    position: XYPosition;
}

export interface ChatMemory {
    input: string;
    output?: string;
    workflow?: string;
}

export interface ChatMemoryResponse {
    id: string;
    input: string;
    output?: string;
    workflow: string;
}

const initialNodes: AgentNode[] = [];
const initialEdges: Edge[] = [];

const nodeLabels = [
    {
        key: 1,
        name: 'documentLoader',
        description: 'Load documents for RAG',
        agent: DocumentUploaderNode
    },
    {
        key: 2,
        name: 'chat',
        description: 'Chat with LLM',
        agent: AskAINode
    },
    {
        key: 3,
        name: 'chatTrigger',
        description: 'When chat message received trigger node',
        agent: ChatTriggerNode
    },
    {
        key: 4,
        name: 'memory',
        description: 'Memory for Chat Agents',
        agent: MemoryNode
    },
    {
        key: 5,
        name: 'chatModel',
        description: 'Chat Model for conversational Chat AI Agents',
        agent: ChatModelNode
    }
];

const chatModelProviders = [
    {
        key: 1,
        name: 'openai',
        label: 'OpenAI Chat Model',
        description: 'For Advanced Usage with AI Chains'
    },
    {
        key: 2,
        name: 'anthropic',
        label: 'Anthropic Chat Model',
        description: 'Language Model Anthropic '
    },
    {
        key: 3,
        name: 'azure',
        label: 'Azure OpenAI Chat Model',
        description: 'For Advanced Usage with AI Chains'
    },
    {
        key: 4,
        name: 'google',
        label: 'Google Gemini Chat Model',
        description: 'Chat Model Google Gemini'
    },
]

const Workflow: React.FC = () => {
    const {id} = useParams<{ id: string }>();
    const [agents, setAgents, onAgentsChange] = useNodesState<AgentNode>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges)
    const [showSidebar, setShowSidebar] = useState<boolean>(false);
    const [queryText, setQueryText] = useState<string>('');
    const [showChatSidebar, setShowChatSidebar] = useState<boolean>(false);
    const [showChatWindow, setShowChatWindow] = useState<boolean>(false);
    const [activeNode, setActiveNode] = useState<AgentNode | null>(null);
    const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
    const [memories, setMemories] = useState<MemoryItem[]>([]);
    const [chatInput, setChatInput] = useState<string>('');
    const [messages, setMessages] = useState([]);

    const filteredList = useFuzzySearchList({
        list: nodeLabels,
        queryText,
        getText: (item) => [item.description],
        // arbitrary mapping function, takes `FuzzyResult<T>` as input
        mapResultItem: ({item, matches: [highlightRanges]}) => ({item, highlightRanges})
    });

    const handleOpenChat = (nodeId: string) => {
        // If agents data isn't loaded yet, store the pending node id.
        if (agents.length === 0) {
            setPendingNodeId(nodeId);
            setShowChatWindow(true);
            return;
        }

        const node = agents.find((agent) => agent.id === nodeId) || null;
        setActiveNode(node);
        setShowChatWindow(true);
    };

    // Once agents have loaded, check if there is a pending node id and process it.
    useEffect(() => {
        if (pendingNodeId && agents.length > 0) {
            const node = agents.find((agent) => agent.id === pendingNodeId) || null;
            setActiveNode(node);
            setPendingNodeId(null); // Clear the pending id
            setMemories(node?.data.properties.memories);
        }
    }, [activeNode?.data.properties.memories, agents, pendingNodeId]);

    const handleOpenChatSidebar = () => {
        setShowChatSidebar(true);
    }

    useEffect(() => {
        const wsUrl = `ws://localhost:8000/ws/workflow/${id}/`;
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('WebSocket connection opened');
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            setMessages(prevMessages => [...prevMessages, data.message]);
            console.log(data.message);
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        socket.onclose = () => {
            console.log('WebSocket connection closed');
        };

        // Cleanup on component unmount
        return () => {
            socket.close();
        };
    }, [id]);

    const getAgents = useCallback(async (): Promise<void> => {
        try {
            const res = await api.get(`api/workflow/${id}/agents/`);
            const data = res.data as AgentData[];
            const agents: AgentNode[] = data.map((data: AgentData) => ({
                id: data.slug,
                type: data.type,
                data: {
                    ...data,
                    ...(data.type === "chatTrigger" ? {onOpenChat: handleOpenChat} : {})
                },
                position: {
                    x: data.properties.position_x,
                    y: data.properties.position_y
                }
            }));

            setAgents(agents);

            agents.map((agent) => {
                const targets = agent.data.next_agents;
                console.log(targets);
                if (targets) {
                    targets.map((target) => {
                        const sourceId = agent.id;
                        const targetId = target;
                        const newEdgeId = uuidv4();
                        setEdges((prevEdges) =>
                            addEdge(
                                {
                                    source: sourceId,
                                    target: targetId,
                                    id: newEdgeId,
                                    animated: true,
                                    style: {stroke: '#f6ab6c', strokeDasharray: '5,5'},
                                },
                                prevEdges
                            )
                        );
                    });
                }
            });
            agents.forEach((agent) => {
                if (agent.type === 'chat') {
                    const memory_node = agent.data.memory_node;
                    if (memory_node) {
                        const chatEdge = {
                            id: uuidv4(),
                            source: agent.id,
                            sourceHandle: `memory-${agent.id}`,
                            target: memory_node,
                            animated: true,
                            style: {stroke: '#f6ab6c', strokeDasharray: '5,5'},
                        };
                        setEdges((prevEdges) => [...prevEdges, chatEdge]);
                    }

                    const chat_model_node = agent.data.chat_model_node;
                    if (chat_model_node) {
                        const chatEdge = {
                            id: uuidv4(),
                            source: agent.id,
                            sourceHandle: `chatModel-${agent.id}`,
                            target: chat_model_node,
                            animated: true,
                            style: {stroke: '#f6ab6c', strokeDasharray: '5,5'},
                        };
                        setEdges((prevEdges) => [...prevEdges, chatEdge]);
                    }
                }
            });
        } catch (error) {
            alert(error);
        }
    }, [id, setAgents, setEdges]);

    const getChatMemories = useCallback(async () => {
        const res = await api.get(`/api/workflow/${id}/memories/`);
        const memories: ChatMemory[] = res.data.map((memory: ChatMemoryResponse) => ({
            input: memory.input,
            output: memory.output,
            workflow: memory.workflow
        }));
        setMemories(memories);
        console.log(memories);
    }, [id]);

    useEffect(() => {
        getAgents().then(r => console.log(r));
        // getChatMemories().then(r => console.log(r));
    }, [getAgents, getChatMemories]);

    const onConnect = useCallback(async (params: OnConnectParams): Promise<void> => {
        const {source, sourceHandle, target, targetHandle} = params;

        const isCircular = (sourceId: string, targetId: string, edges: Edge[]): boolean => {
            const visited = new Set<string>();
            const stack = [targetId];
            while (stack.length > 0) {
                const current = stack.pop();
                if (current === sourceId) return true;
                visited.add(current!);
                edges.forEach((edge) => {
                    if (edge.source === current && !visited.has(edge.target)) {
                        stack.push(edge.target);
                    }
                });
            }
            return false;
        };

        const isValid = (sourceHandleId: string, targetHandleId: string): boolean => {
            const getPrefix = (handleId: string): string => handleId.split('-')[0];
            return getPrefix(sourceHandleId) === getPrefix(targetHandleId);
        };

        const hasParent = (targetId: string, edges: Edge[]): boolean => {
            return edges.some((edge) => edge.target === targetId);
        };

        const handleShowChatWindow = () => {
            setShowChatWindow(true);
        }

        if (!isCircular(source, target, edges) && isValid(sourceHandle, targetHandle)) {
            const newEdgeId = uuidv4();
            setEdges((prevEdges) =>
                addEdge(
                    {
                        ...params,
                        id: newEdgeId,
                        animated: true,
                        style: {stroke: '#f6ab6c', strokeDasharray: '5,5'},
                    },
                    prevEdges
                )
            );
            const sourceAgent = agents.find(agent => agent.id === source);
            const targetAgent = agents.find(agent => agent.id === target);
            if (sourceAgent && targetAgent) {
                const data = sourceAgent.data;
                if (targetAgent.type === 'memory') {
                    data.memory_node = targetAgent.id;
                } else if (targetAgent.type === 'chatModel') {
                    data.chat_model_node = targetAgent.id;
                } else if (targetAgent.type === 'toolNodes') {
                    data.tool_nodes?.push(targetAgent.id);
                } else {
                    data.next_agents?.push(targetAgent.id);
                }
                const res = await api.post('/api/agent/create/', {
                    ...data
                });
                console.log(res);
            }
        } else {
            alert('Circular connection is not allowed!');
        }
    }, [agents, edges, setEdges]);

    const handleOpenSidebar = () => {
        setShowSidebar(true);
    };

    const handleSearchAgents = (e: ChangeEvent<HTMLInputElement>) => {
        setQueryText(e.target.value);
    };

    const handleAddAgent = async (key: number) => {
        console.log(key);
        const foundAgent = nodeLabels.find((agent) => agent.key === key);
        console.log(foundAgent);
        if (!foundAgent) return;

        const agentType = foundAgent.name;
        const slug = uuidv4();

        let newAgentData: AgentData;

        if (agentType === 'documentLoader') {
            newAgentData = {
                slug: slug,
                type: 'documentLoader',
                workflow: id,
                next_agents: [],
                properties: {
                    files: [],
                    embedding_model: 'text-embedding-ada-002',
                    position_x: 0,
                    position_y: 0,
                },
            };
        } else if (agentType === 'chat') {
            newAgentData = {
                slug: slug,
                type: 'chat',
                workflow: id,
                next_agents: [],
                properties: {
                    generation_model: 'gpt-4o',
                    temperature: 0.5,
                    context: '',
                    prompt: '',
                    position_x: 0,
                    position_y: 0,
                },
            };
        } else if (agentType === 'chatTrigger') {
            newAgentData = {
                slug: slug,
                type: 'chatTrigger',
                workflow: id,
                next_agents: [],
                onOpenChat: handleOpenChat,
                properties: {
                    position_x: 0,
                    position_y: 0,
                    memories: []
                },
            }
        } else if (agentType === 'memory') {
            newAgentData = {
                slug: slug,
                type: 'memory',
                workflow: id,
                next_agents: [],
                properties: {
                    position_x: 0,
                    position_y: 0,
                    memories: []
                },
            }
        } else if (agentType === 'chatModel') {
            newAgentData = {
                slug: slug,
                type: 'chatModel',
                workflow: id,
                next_agents: [],
                properties: {
                    position_x: 0,
                    position_y: 0,
                    service: 'openai',
                    model: 'gpt-4o'
                },
            }
        } else {
            return;
        }

        const newNode: AgentNode = {
            id: slug,
            type: newAgentData.type,
            data: newAgentData,
            position: {x: 0, y: 0},
        };

        // Update the nodes state (append new node)
        setAgents((prevAgents) => [...prevAgents, newNode]);

        const res = await api.post(`/api/agent/create/`, newAgentData);
        console.log(res.data);
    };

    const handleUpdateChatInput = (e: ChangeEvent<HTMLInputElement>) => {
        setChatInput(e.target.value);
    }

    const handleSubmitChat = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const newMemory: MemoryItem = {
            role: "user",
            content: [{
                type: "text",
                text: chatInput
            }]
        };
        activeNode?.data.properties.memories.push(newMemory);
        setMemories((prevMemories) => [...prevMemories, newMemory]);
        const newAgentData = {
            slug: activeNode?.id,
            type: 'chatTrigger',
            workflow: id,
            next_agents: [],
            onOpenChat: handleOpenChat,
            properties: {
                position_x: 0,
                position_y: 0,
                memories: memories
            },
        };
        // const res = await api.post(`/api/agent/create/`, newAgentData);
        const res = await api.post(`/api/start-workflow/`, {node_id: id});
        console.log(res.data);
        // const res = await api.post('/api/memory/create/', newMemory);
        // const newMemoryUpdated = {
        //     input: res.data.input,
        //     output: res.data.output,
        //     workflow: res.data.workflow
        // }
        // setMemories((prevMemories) => [...prevMemories, newMemoryUpdated]);
    }

    return (
        <div className="h-screen">
            <div className="p-4 flex justify-between items-center border-b-1 border-gray-400">
                <a className="" href="/">
                    <h1 className="text-2xl">AI Workflow Automation</h1>
                </a>
                <div className="flex space-x-10">
                    <a className="text-lg" href="/profile">Profile</a>
                    <a className="text-lg" href="/logout">Logout</a>
                </div>
            </div>
            <div className="relative">
                {showChatWindow && activeNode &&
                    <div className="absolute bottom-0 w-full bg-white z-100 border-1 rounded-lg">
                        <div className="h-96 overflow-y-auto">
                            <div className="flex justify-between bg-gray-200 w-full p-4 mb-4 items-center">
                                <h1 className="text-2xl">
                                    Chat
                                </h1>
                                <div className="flex space-x-4 items-center">
                                    <div>
                                        Session {activeNode.id}
                                    </div>
                                    <div>
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                             stroke-width="1.5" stroke="currentColor" className="size-4">
                                            <path stroke-linecap="round" stroke-linejoin="round"
                                                  d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"/>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            {
                                activeNode.data.properties.memories?.map((memory: MemoryItem, index) => {
                                    const lastContent = memory.content[memory.content.length - 1]?.text;
                                    return (
                                        <div key={index} className="w-full px-4">
                                            <div className="flex justify-start p-4">
                                                <div className="w-[calc(40%)] bg-gray-50 p-4 rounded-xl">
                                                    {memory.role === 'user' ? lastContent : ''}
                                                </div>
                                            </div>
                                            <div className="flex justify-end p-4">
                                                {memory.role === 'assistant' && (
                                                    <div className="w-[calc(40%)] bg-gray-300 p-4 rounded-xl">
                                                        {memory.role === 'assistant' ? lastContent : ''}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            }

                        </div>
                        <div className="w-full px-4">
                            <form action="" onSubmit={handleSubmitChat}>
                                <input type="text" className="border-1 rounded-lg p-2 w-full" value={chatInput}
                                       onChange={handleUpdateChatInput}/>
                            </form>
                        </div>
                    </div>
                }
                <button className="z-50 absolute rounded-md border-1 p-2 right-4 top-4 hover:bg-black hover:text-white">
                    Run
                </button>
                <div className="absolute bg-white left-4 top-4 z-50">
                    {
                        !showSidebar ? (
                            <button className="" onClick={handleOpenSidebar}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                                     stroke-width="1.5" stroke="currentColor" className="size-8">
                                    <path stroke-linecap="round" stroke-linejoin="round"
                                          d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
                                </svg>

                            </button>
                        ) : (
                            <div className="rounded-lg">
                                <div className="flex justify-center space-y-4">
                                    <div className="space-y-6">
                                        <div>
                                            <input type="text" className="p-3 border-1 rounded-xl"
                                                   placeholder="Search Agents ..."
                                                   onChange={handleSearchAgents}/>
                                        </div>
                                        <div>
                                            {
                                                queryText && filteredList.map(({item, highlightRanges}) => (
                                                    <div key={item.key} className="border-t-1 border-gray-300 p-2"
                                                         onClick={() => handleAddAgent(item.key)}>
                                                        <div className="text-sm">
                                                            <div className="text-lg">
                                                                {item.name}
                                                            </div>
                                                            <Highlight
                                                                text={item.description}
                                                                ranges={highlightRanges}
                                                            />
                                                        </div>
                                                    </div>
                                                ))
                                            }
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </div>
                <div className="absolute right-0 top-0 z-50 bg-zinc-700 h-full">
                    {
                        showChatSidebar && (
                            <div>
                                <div className="bg-zinc-500 p-4">
                                    <h1 className="text-2xl text-white">
                                        Language Models
                                    </h1>
                                </div>
                                <div className="p-4 text-white">
                                    <div>
                                        <input type="text" placeholder="Search nodes ..."
                                               className="rounded-md border-1 border-blue-200 p-2 w-full"/>
                                    </div>
                                    <div className="mt-4">
                                        {chatModelProviders.map((provider) => (
                                            <div className="my-4" key={provider.key}>
                                                <div>{provider.label}</div>
                                                <div className="text-xs">{provider.description}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )
                    }
                </div>
                <div style={{width: '100vw', height: '100vh'}}>
                    <ReactFlow
                        nodes={agents}
                        edges={edges}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        onNodesChange={onAgentsChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        fitView
                    >
                        <Controls/>
                        <MiniMap/>
                        <Background variant="dots" gap={12} size={1}/>
                    </ReactFlow>
                </div>
            </div>
        </div>
    );

};

const FlowProvider: React.FC = () => (
    <ReactFlowProvider>
        <Workflow/>
    </ReactFlowProvider>
);

export default FlowProvider;