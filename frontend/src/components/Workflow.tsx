import {v4 as uuidv4} from "uuid";
import {useParams} from "react-router-dom";
import api from "../api";

import React, {
    ChangeEvent,
    FormEvent,
    useCallback,
    useEffect, useRef,
    useState
} from "react";

import {
    ReactFlowProvider,
    ReactFlow,
    useNodesState,
    useEdgesState,
    addEdge,
    Edge,
    Controls,
    MiniMap,
    Background,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import DocumentLoaderAgent from "./DocumentLoaderAgent.tsx";
import ChatAgent from "./ChatAgent.tsx";
import ChatTriggerNode from "./ChatTriggerNode.tsx";
import MemoryNode from "./MemoryNode.tsx";
import ChatModelNode from "./ChatModelNode.tsx";
import VectorStoreNode from "./VectorStoreNode.tsx";

import {AgentNode, AgentData, isAgentNodeOfType, getFlowType, DocumentLoaderProperties} from '../nodeTypes';
import {MemoryItem} from "../nodeTypes.ts";

import {useFuzzySearchList, Highlight} from '@nozbe/microfuzz/react'

const nodeTypes = {
    documentLoader: DocumentLoaderAgent,
    chat: ChatAgent,
    chatTrigger: ChatTriggerNode,
    memory: MemoryNode,
    chatModel: ChatModelNode,
    vectorStore: VectorStoreNode
};

const edgeTypes = {};

export interface FileResponse {
    id: string;
    file: string;
    date: string;
    agent: string;
}

export interface FileType {
    id: string;
    extension: string;
    name: string;
    date: string;
}

export interface OnConnectParams {
    source: string;
    target: string;
    sourceHandle: string | null;
    targetHandle: string | null;
}

const initialNodes: AgentNode[] = [];
const initialEdges: Edge[] = [];

const nodeLabels = [
    {
        key: 1,
        name: 'documentLoader',
        description: 'Load documents for RAG',
    },
    {
        key: 2,
        name: 'chat',
        description: 'Chat with LLM',
    },
    {
        key: 3,
        name: 'chatTrigger',
        description: 'When chat message received trigger node',
    },
    {
        key: 4,
        name: 'memory',
        description: 'Memory for Chat Agents',
    },
    {
        key: 5,
        name: 'chatModel',
        description: 'Chat Model for conversational Chat AI Agents',
    },
    {
        key: 6,
        name: 'vectorStore',
        description: 'Information retrieval from documents',
    }
];

const Workflow: React.FC = () => {
    const {id} = useParams<{ id: string }>();
    const [agents, setAgents, onAgentsChange] = useNodesState<AgentNode>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges)
    const [showSidebar, setShowSidebar] = useState<boolean>(false);
    const [queryText, setQueryText] = useState<string>('');
    const [showChatWindow, setShowChatWindow] = useState<boolean>(false);
    const [activeNode, setActiveNode] = useState<AgentNode | null>(null);
    const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
    const [memories, setMemories] = useState<MemoryItem[]>([]);
    const [chatInput, setChatInput] = useState<string>('');
    const [messages, setMessages] = useState<string[]>([]);

    const filteredList = useFuzzySearchList({
        list: nodeLabels,
        queryText,
        getText: (item) => [item.description],
        mapResultItem: ({item, matches: [highlightRanges]}) => ({item, highlightRanges})
    });

    const agentsRef = useRef<AgentNode[]>(agents);
    useEffect(() => {
        agentsRef.current = agents;
    }, [agents]);


    const handleDeleteNode = useCallback(async (id: string) => {
        const res = await api.delete(`/api/agent/${id}/delete/`);
        console.log(res.data);
        setAgents(prevAgents => prevAgents.filter(agent => agent.id !== id));
    }, [setAgents]);

    const handleOpenChat = useCallback((nodeId: string) => {
        const currentAgents = agentsRef.current;
        if (currentAgents.length === 0) {
            setPendingNodeId(nodeId);
            setShowChatWindow(true);
            return;
        }
        const node = currentAgents.find((agent) => agent.id === nodeId) || null;
        console.log(node?.id);
        setActiveNode(node);
        setShowChatWindow(true);
    }, []);


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

            setAgents(prevAgents =>
                prevAgents.map(agent =>
                    agent.id === data.node_id
                        ? {...agent, data: {...agent.data, status: data.status}}
                        : agent
                )
            );
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
    }, [id, setAgents]); // Removed `messages` from dependency array


    const getAgents = useCallback(async (): Promise<void> => {
        try {
            const res = await api.get(`api/workflow/${id}/agents/`);
            const data = res.data as AgentData[];
            const agents: AgentNode[] = data.map((data: AgentData) => ({
                id: data.slug,
                type: data.type,
                data: {
                    ...data,
                    ...(data.type === "chatTrigger" ? {onOpenChat: handleOpenChat} : {}),
                    status: 'pending',
                    onDelete: handleDeleteNode,
                    flowType: getFlowType(data.type),
                    onRun: handleRunDocumentLoaderNode
                },
                position: {
                    x: data.properties.position_x,
                    y: data.properties.position_y,
                },
            }));

            setAgents(agents);

            // Create edges based on next_agents
            agents.forEach((agent) => {
                const targets = agent.data.next_agents;
                if (targets) {
                    targets.forEach((target) => {
                        const newEdge: Edge = {
                            source: agent.id,
                            target: target,
                            id: uuidv4(),
                            animated: true,
                            style: {stroke: '#f6ab6c', strokeDasharray: '5,5'},
                        };
                        setEdges((prevEdges) => addEdge(newEdge, prevEdges));
                    });
                }
                if (agent.type === 'chat') {
                    console.log(agent.data);
                    const {memory_node, chat_model_node, retriever_node} = agent.data;
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
                    if (retriever_node) {
                        console.log('fjfkjdsnfds');
                        const chatEdge = {
                            id: uuidv4(),
                            source: agent.id,
                            sourceHandle: `retriever-${agent.id}`,
                            target: retriever_node,
                            targetHandle: `retriever-${retriever_node}`,
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
    }, [handleDeleteNode, handleOpenChat, id, setAgents, setEdges]);


    useEffect(() => {
        getAgents().then(r => console.log(r));
        // getChatMemories().then(r => console.log(r));
    }, [getAgents]);

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

        const isValid = (sourceHandleId: string | null, targetHandleId: string | null): boolean => {
            if (!sourceHandleId || !targetHandleId) {
                return false;
            }
            const getPrefix = (handleId: string): string => handleId.split('-')[0];
            return getPrefix(sourceHandleId) === getPrefix(targetHandleId);
        };

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
                } else if (targetAgent.type === 'vectorStore') {
                    data.retriever_node = targetAgent.id;
                } else {
                    data.next_agents?.push(targetAgent.id);
                }

                console.log("node: ", data.retriever_node);
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
                onDelete: handleDeleteNode,
                status: 'pending',
                flowType: 'trigger',
                onRun: handleRunDocumentLoaderNode,
                onFilesUpdate: handleUpdateFiles
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
                status: 'pending',
                onDelete: handleDeleteNode,
                flowType: 'main'
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
                status: 'pending',
                onDelete: handleDeleteNode,
                flowType: 'trigger'
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
                status: 'pending',
                onDelete: handleDeleteNode,
                flowType: 'sub'
            }
        } else if (agentType === 'vectorStore') {
            newAgentData = {
                slug: slug,
                type: 'vectorStore',
                workflow: id,
                next_agents: [],
                properties: {
                    position_x: 0,
                    position_y: 0,
                },
                status: 'pending',
                onDelete: handleDeleteNode,
                flowType: 'tool'
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
                status: 'pending',
                onDelete: handleDeleteNode,
                flowType: 'sub'
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
        const node = agents.find((agent) => isAgentNodeOfType(agent, 'chatTrigger'));
        if (!node) {
            return;
        }

        // TypeScript now knows node.data.properties is ChatTriggerProperties.
        node.data.properties.memories?.push(newMemory);
        setMemories((prevMemories) => [...prevMemories, newMemory]);
        // const newAgentData = {
        //     slug: activeNode?.id,
        //     type: 'chatTrigger',
        //     workflow: id,
        //     next_agents: [],
        //     onOpenChat: handleOpenChat,
        //     properties: {
        //         position_x: 0,
        //         position_y: 0,
        //         memories: memories
        //     },
        // };
        const triggerId = activeNode?.id;
        console.log('trigger id: ', triggerId);
        const res = await api.post(`/api/start-workflow/`, {node_id: id, trigger_id: triggerId, input: chatInput});
        console.log(res.data);
    }

    const handleRunDocumentLoaderNode = async (triggerId: string) => {
        const res = await api.post(`/api/start-workflow/`, {node_id: id, trigger_id: triggerId, input: chatInput});
        console.log(res.data);
    }

    const handleUpdateFiles = async (nodeId: string) => {
        const node = agents.find((agent) => agent.id === nodeId) || null;
        if (!node) {
            return;
        }
        const res = await api.get(`/api/${nodeId}/files/`);
        const files: FileType[] = res.data.map((file: FileResponse) => ({
            id: file.id,
            extension: file.file.split('.').pop(),
            name: file.file.replace(/^.*[\\/]/, ''),
            date: file.date
        }));
        const prop = node.data.properties as DocumentLoaderProperties;
        prop.files.push(...files);
        node.data.properties.files = prop.files;
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
                                             strokeWidth="1.5" stroke="currentColor" className="size-4">
                                            <path strokeLinecap="round" strokeLinejoin="round"
                                                  d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3"/>
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            {
                                memories?.map((memory: MemoryItem, index) => {
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
                                     strokeWidth="1.5" stroke="currentColor" className="size-8">
                                    <path strokeLinecap="round" strokeLinejoin="round"
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
                        <Background gap={12} size={1}/>
                    </ReactFlow>
                </div>
            </div>
        </div>
    )
        ;

};

const FlowProvider: React.FC = () => (
    <ReactFlowProvider>
        <Workflow/>
    </ReactFlowProvider>
);

export default FlowProvider;