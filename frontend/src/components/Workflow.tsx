import { v4 as uuidv4 } from "uuid";
import { useParams } from "react-router-dom";
import api from "../api";
import ReactMarkdown from 'react-markdown';


import React, {
    ChangeEvent,
    FormEvent,
    useCallback,
    useEffect,
    useRef,
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
    Background,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import DocumentLoaderAgent from "./DocumentLoaderAgent.tsx";
import ChatAgent from "./ChatAgent.tsx";
import ChatTriggerNode from "./ChatTriggerNode.tsx";
import MemoryNode from "./MemoryNode.tsx";
import ChatModelNode from "./ChatModelNode.tsx";
import VectorStoreNode from "./VectorStoreNode.tsx";

import { AgentNode, AgentData, isAgentNodeOfType, getFlowType, DocumentLoaderProperties, ChatTriggerProperties } from '../nodeTypes';
import { MemoryItem } from "../nodeTypes.ts";

import { useFuzzySearchList, Highlight } from '@nozbe/microfuzz/react'

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

export interface BaseProperties {
    position_x: number;
    position_y: number;
    memories: MemoryItem[];
}

export interface ConnectionResponse {
    target: string;
    connection_type: string;
}

export interface AgentResponse {
    id: string;
    slug: string;
    type: string;
    workflow: string;
    properties: BaseProperties;
    connections_out: ConnectionResponse[];
    memories: ChatMemory[];
}

export interface ChatMemory {
    id: string;
    input: string;
    output?: string;
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

export interface Log {
    type: string;
    message: string;
}

const initialNodes: AgentNode[] = [];
const initialEdges: Edge[] = [];

const getPositionForType = (type) => {
  switch (type) {
    case 'chatTrigger':
      // ChatTrigger at x=0, y=0 (left side)
      return { x: 200, y: 200 };
    case 'chat':
      // Chat node to the right of chatTrigger (x positive, same y)
      return { x: 300, y: 200 };
    case 'chatModel':
      // ChatModel above chat node with negative y and negative x
      return { x: 315, y: 300 };
    case 'vectorStore':
      // Retriever at same -y as chatModel but x=0
      return { x: 300, y: 375 };
    case 'memory':
      // Memory at same -y as chatModel but positive x offset
      return { x: 446, y: 300 };
    case 'documentLoader':
      // DocumentLoader above with negative y and negative x
      return { x: 200, y: 375 };
    default:
      // Default fallback
      return { x: 0, y: 0 };
  }
};

const Workflow: React.FC = () => {
    const { id } = useParams < { id: string } > ();

    const [agents, setAgents, onAgentsChange] = useNodesState<AgentNode>(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

    const [activeNode, setActiveNode] = useState <AgentNode | null>(null);
    const [activeDocumentLoader, setActiveDocumentLoader] = useState<AgentNode | null>(null);

    const [memories, setMemories] = useState<ChatMemory[]>([]);
    const [chatInput, setChatInput] = useState<string>('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [currentBatchIndex, setCurrentBatchIndex] = useState(0);

    const [logs, setLogs] = useState <Log[]>([]);

    const textareaRef = useRef <HTMLTextAreaElement>(null);
    const logsContainerRef = useRef <HTMLDivElement>(null);
    const chatContainerRef = useRef <HTMLDivElement>(null);
    const agentsRef = useRef <AgentNode[]>(agents);

    const handleKeyDown = (e: React.KeyboardEvent < HTMLTextAreaElement > ) => {
        if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            handleSubmitChat(e);
        }
    };

    useEffect(() => {
        agentsRef.current = agents;
    }, [agents]);

    useEffect(() => {
        if (logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
    }, [logs]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [memories]);

    useEffect(() => {
        if (textareaRef.current) {
            const textarea = textareaRef.current;
            const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);

            textarea.style.height = 'auto';

            const maxHeight = lineHeight * 5;
            const newHeight = Math.min(textarea.scrollHeight, maxHeight);

            textarea.style.height = `${newHeight}px`;
            textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden';
        }
    }, [chatInput]);


    useEffect(() => {
        const wsUrl = `ws://localhost:8000/ws/workflow/${id}/`;
        const socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('WebSocket connection opened');
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log(data.message);

            switch (data.node_id) {
                case -1:
                    setAgents(prevAgents =>
                        prevAgents.map(agent => {
                            if (agent.data.status === 'running') {
                                return { ...agent, data: { ...agent.data, status: 'failed' } };
                            } else if (agent.data.status === 'completed') {
                                return agent;
                            } else {
                                return { ...agent };
                            }
                        })
                    );
                    setLogs((prev) => [...prev, { type: 'error', message: 'Error: ' + data.message }]);
                    return;

                case 1:
                    setLogs((prev) => [...prev, { type: 'warning', message: 'Warning: ' + data.message }]);
                    return;
                default:
                    setAgents(prevAgents =>
                        prevAgents.map(agent =>
                            agent.id === data.node_id ? { ...agent, data: { ...agent.data, status: data.status } } :
                            agent
                        )
                    );
                    setLogs((prev) => [...prev, { type: 'info', message: 'Info: ' + data.message }]);
                    return;
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        socket.onclose = () => {
            console.log('WebSocket connection closed');
        };

        return () => {
            socket.close();
        };
    }, [id, setAgents]);


    const getAgents = useCallback(async (data): Promise < void > => {
        try {
            const agents: AgentNode[] = data.map((agentData: AgentResponse) => {
                const next_agents: string[] = [];
                let memory_node: string | undefined = undefined;
                let chat_model_node: string | undefined = undefined;
                let retriever_node: string | undefined = undefined;

                agentData.connections_out.forEach((conn: ConnectionResponse) => {
                    switch (conn.connection_type) {
                        case 'next':
                            next_agents.push(conn.target);
                            break;
                        case 'memory':
                            memory_node = conn.target;
                            break;
                        case 'chat_model':
                            chat_model_node = conn.target;
                            break;
                        case 'retriever':
                            retriever_node = conn.target;
                            break;
                        default:
                            break;
                    }
                });

                console.log("type: ", agentData.type);

                if (agentData.type === 'chatTrigger') {
                    setMemories(agentData.memories || []);
                }

                return {
                    id: agentData.slug,
                    type: agentData.type,
                    data: {
                        ...agentData,
                        next_agents,
                        memory_node,
                        chat_model_node,
                        retriever_node,
                        status: 'pending',
                        flowType: getFlowType(agentData.type),
                    },
                    position: getPositionForType(agentData.type),
                }
            });

            const activeChatAgent = agents.find((agent) => agent.data.type === 'chatTrigger');
            if (activeChatAgent) {
                setActiveNode(activeChatAgent);
            };

            const activeDocumentLoader = agents.find((agent) => agent.data.type === 'documentLoader');
            if (activeDocumentLoader) {
                setActiveDocumentLoader(activeDocumentLoader);
            };

            setAgents(agents);
            const newEdges: Edge[] = [];
            agents.forEach((agent) => {
                agent.data.next_agents?.forEach((target: string) => {
                    newEdges.push({
                        id: uuidv4(),
                        source: agent.id,
                        target,
                        animated: true,
                        style: { stroke: '#f6ab6c', strokeDasharray: '5,5' },
                    });
                });

                if (agent.data.memory_node) {
                    newEdges.push({
                        id: uuidv4(),
                        source: agent.id,
                        sourceHandle: `memory-${agent.id}`,
                        target: agent.data.memory_node,
                        targetHandle: `memory-${agent.data.memory_node}`,
                        animated: true,
                        style: { stroke: '#f6ab6c', strokeDasharray: '5,5' },
                    });
                }

                if (agent.data.chat_model_node) {
                    newEdges.push({
                        id: uuidv4(),
                        source: agent.id,
                        sourceHandle: `chatModel-${agent.id}`,
                        target: agent.data.chat_model_node,
                        targetHandle: `chatModel-${agent.data.chat_model_node}`,
                        animated: true,
                        style: { stroke: '#f6ab6c', strokeDasharray: '5,5' },
                    });
                }

                if (agent.data.retriever_node) {
                    newEdges.push({
                        id: uuidv4(),
                        source: agent.id,
                        sourceHandle: `retriever-${agent.id}`,
                        target: agent.data.retriever_node,
                        targetHandle: `retriever-${agent.data.retriever_node}`,
                        animated: true,
                        style: { stroke: '#f6ab6c', strokeDasharray: '5,5' },
                    });
                }
            });
            setEdges((prev) => [...prev, ...newEdges]);

        } catch (error) {
            alert(error);
        }
    }, [
        id,
        setAgents,
        setEdges,
        getFlowType,
    ]);


    useEffect(() => {
      const fetchAgents = async () => {
        try {
          const { data } = await api.get(`api/workflow/${id}/agents/`) as AgentResponse[];
          await getAgents(data);
        } catch (error) {
          console.error('Error fetching agents:', error);
        }
      };

      fetchAgents();
    }, [id, getAgents]);

    const onConnect = useCallback(async (params: OnConnectParams): Promise < void > => {
        const { source, sourceHandle, target, targetHandle } = params;

        const isCircular = (sourceId: string, targetId: string, edges: Edge[]): boolean => {
            const visited = new Set < string > ();
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
                addEdge({
                        ...params,
                        id: newEdgeId,
                        animated: true,
                        style: { stroke: '#f6ab6c', strokeDasharray: '5,5' },
                    },
                    prevEdges
                )
            );
            const sourceAgent = agents.find(agent => agent.id === source);
            const targetAgent = agents.find(agent => agent.id === target);

            let connectionType = 'next';

            if (sourceAgent && targetAgent) {
                if (targetAgent.type === 'memory') {
                    connectionType = 'memory';
                } else if (targetAgent.type === 'chatModel') {
                    connectionType = 'chat_model';
                } else if (targetAgent.type === 'vectorStore') {
                    if (targetHandle?.split("-")[0] === 'main') {
                        connectionType = 'next'
                    } else if (targetHandle?.split("-")[0] === 'retriever') {
                        connectionType = 'retriever';
                    }
                } else {
                    connectionType = 'next';
                }

                const payload = {
                    connection_type: connectionType,
                    source: sourceAgent.id,
                    target: targetAgent.id,
                };

                const res = await api.post('/api/connection/create/', payload);

                const connectionData = res.data as ConnectionResponse;

                switch (connectionData.connection_type) {
                    case "chat_model":
                        sourceAgent.data.chat_model_node = connectionData.target;
                        break;
                    case "memory":
                        sourceAgent.data.memory_node = connectionData.target;
                        break;
                    case "retriever":
                        sourceAgent.data.retriever_node = connectionData.target;
                        break;
                    default:
                        sourceAgent.data.next_agents?.push(connectionData.target);
                }
            }
        } else {
            alert('Connection is not allowed!');
        }
    }, [agents, edges, setEdges]);


    const handleUpdateChatInput = (e: ChangeEvent < HTMLInputElement > ) => {
        setChatInput(e.target.value);
    }

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;

      const files = Array.from(e.target.files);

      if (!activeDocumentLoader || files.length === 0) return;

      const BatchSize = 5;

      const processBatch = async (filesBatch: File[]) => {
        const formData = new FormData();
        filesBatch.forEach((file) => {
          formData.append('files', file, file.name);
        });
        formData.append('node_id', id);
        formData.append('trigger_id', activeDocumentLoader.id);

        await api.post(`/api/start-workflow/${id}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      };

      try {
        for (let i = 0; i < files.length; i += BatchSize) {
          const filesBatch = files.slice(i, i + BatchSize);
          await processBatch(filesBatch);
        }
      } catch (error) {
        console.error('Error processing file batches:', error);
      }
    };


    const handleSubmitChat = async (e: FormEvent < HTMLFormElement > ) => {
        e.preventDefault();

        if (!activeNode || chatInput.length === 0) return;

        const memID = uuidv4();
        const newMemory: ChatMemory = {
            id: memID,
            input: chatInput,
            agent: activeNode.id
        };

        setChatInput('');
        setMemories((prevMemories) => [...prevMemories, newMemory]);

        if (chatInput.trim()) {
            const triggerId = activeNode?.id;
            const res = await api.post(`/api/start-workflow/${id}/`, { 
                node_id: id, 
                trigger_id: triggerId, 
                input: newMemory 
            });
            const modifiedMemory: ChatMemory = res.data.new_memory;
            setMemories((prevMemories) =>
                prevMemories.map((memory) =>
                    memory.id === modifiedMemory.id ? modifiedMemory : memory
                )
            );
        }
    }

    const handleSubmitDocuments = async (e: ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();

        console.log(selectedFiles.length);

        if (!activeDocumentLoader || selectedFiles.length === 0) return;

        const processBatch = async (filesBatch: File[]) => {
          const formData = new FormData();
          filesBatch.forEach((file) => {
            formData.append('files', file, file.name);
          });
          formData.append('node_id', id);
          formData.append('trigger_id', triggerId);

          await api.post(`/api/start-workflow/${id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        };

        try {
          for (let i = 0; i < selectedFiles.length; i += BatchSize) {
            const filesBatch = selectedFiles.slice(i, i + BatchSize);
            await processBatch(filesBatch);
          }
          setSelectedFiles([]);
        } catch (error) {
          console.error('Error processing file batches:', error);
        }
    }

    const handleResetWorkflow = async () => {
        const { data } = await api.post(`/api/reset-workflow/${id}/`) as AgentResponse;
        getAgents(data);
    }


    return (
        <div className= "h-screen overflow-hidden flex flex-col bg-gray-900 text-gray-100" >
        {/* Navbar (unchanged) */ }
        <header className = "h-16 p-4 flex justify-between items-center border-b border-gray-700" >
            <a href="/" >
                <h1 className="text-2xl">AI Workflow Automation</h1>
                    </a>
                    <div className="flex space-x-10">
                        <a className="text-lg" href = "/profile" > Profile </a>
                            <a className="text-lg" href="/logout">
                            Logout
                            </a>
                    </div>
        </header>

        { /* Main content area */ }
        <div className="flex-1 min-h-0 grid grid-rows-2 grid-cols-[70%_30%] overflow-hidden" >
        {/* Top Left: ReactFlow Component */ }
        < div className = "border border-gray-700 p-2 overflow-hidden" >
            <ReactFlow 
          nodes={ agents }
    edges = { edges }
    nodeTypes = { nodeTypes }
    edgeTypes = { edgeTypes }
    onNodesChange = { onAgentsChange }
    onEdgesChange = { onEdgesChange }
    onConnect = { onConnect }
    fitView
    className = "h-full w-full"
        >
        <Controls
            showZoom
    showFitView
    showInteractive = { false}
    position = "bottom-left"
    style = {{
        flexDirection: "row",
            gap: "8px",
                backgroundColor: "transparent",
                    padding: "8px",
                        borderRadius: "8px",
            }
}
          />
    < Background gap = { 12} size = { 1} />
        </ReactFlow>
        </div>

        { /* Top Right: Console */ }
        <div className="border border-gray-700 bg-gray-800 text-gray-100 flex flex-col h-full" >
    <h1 className="text-2xl text-center p-4 bg-gray-700" > Logs </h1>
        < div 
ref = { logsContainerRef }
className = "p-4 overflow-y-auto flex-1 min-h-0"
    >
{
    logs.map((log: Log, index) => (
        <div 
                key= { index }
                className = {`text-sm mb-2 ${log.type === 'error' ? 'text-red-400' :
            log.type === 'warning' ? 'text-yellow-400' : 'text-gray-300'
            }`}
    >
    [{ new Date().toLocaleTimeString() }] { log.message }
</div>
            ))}
</div> <
        /div>

        { /* Bottom Left: Chat Window */ }
        <div className="border border-gray-700 flex flex-col min-h-0" >
    {/* Chat Messages Area */ }
    <div ref = { chatContainerRef } className = "flex-1 overflow-y-auto min-h-0 p-4">
    <h1 className="text-2xl text-center p-4 bg-gray-700 sticky top-0 rounded-lg" > Chat </h1>
    {
        activeNode && (
            <div className="text-sm text-gray-400 mb-4 text-center" >
                { activeNode.id }
            </div>
        )
    }
{
    memories?.map((memory: ChatMemory, index) => {
        return (
            <div key= { index } className = "mb-4" >
            {
                memory.input && (
                    <div className="flex justify-start">
                        <div className="w-[40%] bg-gray-800 text-gray-100 p-4 rounded-xl">
                            <ReactMarkdown>{memory.input}</ReactMarkdown>
                            </div>
                            </div>
                  )
}
{
    memory.output && (
        <div className="flex justify-end" >
            <div className="w-[40%] bg-gray-700 text-gray-100 p-4 rounded-xl" >
                <ReactMarkdown>{memory.output}</ReactMarkdown>
                </div>
                </div>
                  )
}
</div>
              );
            })}
</div>

        { /* Chat Input (unchanged) */ }
        <div className="p-4 border-t border-gray-700" >
    <form onSubmit={ handleSubmitChat }>
        <textarea
              ref={ textareaRef }
className = "border border-gray-600 rounded-lg p-2 w-full bg-gray-800 text-gray-100 resize-none overflow-y-auto"
value = { chatInput }
onChange = { handleUpdateChatInput }
onKeyDown = { handleKeyDown }
placeholder = "Type your message... (Ctrl + Enter for new line)"
rows = { 1}
style = {{
    minHeight: '2.5rem',
        maxHeight: '10rem',
              }}
            />
    </form>
    </div> <
        /div>

        { /* Bottom Right: File Upload */ }
        <div className="flex flex-col justify-between w-full min-h-0 h-full" >
    <div className="p-4 w-full" >
        <h1 className="text-2xl p-4 bg-gray-700 text-center rounded-lg sticky top-0" > retrieval </h1>
{
    activeDocumentLoader && (
        <div className="text-sm text-gray-400 mb-4 text-center" >
            { activeDocumentLoader.id }
            </div>
    )
}
<div className="w-full h-48 mt-8 border-1 rounded-lg" >
    <label htmlFor="dropzone-file" className = "flex flex-col items-center justify-center w-full h-full border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 dark:hover:bg-gray-800 dark:bg-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:hover:border-gray-500 dark:hover:bg-gray-600" >
        <div class="flex flex-col items-center justify-center pt-5 pb-6" >
            <svg class="w-8 h-8 mb-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns = "http://www.w3.org/2000/svg" fill = "none" viewBox = "0 0 20 16" >
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d = "M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
                    </svg>
                    < p class="mb-2 text-sm text-gray-500 dark:text-gray-400" > <span class="font-semibold" > Click to upload < /span> or drag and drop</p >
                        <p class="text-xs text-gray-500 dark:text-gray-400" > PDF, DOCX, MD, TXT, JSON </p>
                            </div>
                            <input 
    id="dropzone-file" 
    type="file" 
    className="hidden" 
    onChange={handleFileChange} 
    multiple
  />
                                </label>
                                </div>
                                </div>
  
{/* Sticky buttons container */ }
<div className="sticky bottom-0 p-4 mt-auto space-y-4" >
    <button onClick={handleResetWorkflow} className="p-4 bg-amber-600 rounded-md w-full hover:bg-amber-700 transition-colors" >
        Reset Workflow
            </button>
                    </div>
                    </div> <
        /div> < /
        div >
    );



};

const FlowProvider: React.FC = () => (
    <ReactFlowProvider>
    <Workflow/>
    </ReactFlowProvider>
);

export default FlowProvider;