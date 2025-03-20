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

export interface BaseProperties {
	position_x: number;
	position_y: number;
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
	const [activeDocumentLoader, setActiveDocumentLoader] = useState<AgentNode | null>(null);
	const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
	const [memories, setMemories] = useState<MemoryItem[]>([]);
	const [chatInput, setChatInput] = useState<string>('');
	const [messages, setMessages] = useState<string[]>([]);
	const [warnings, setWarnings] = useState<string[]>([]);

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

			if (data.node_id === -1) {
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

				return;
			}

			else if (data.node_id === 1) {
				setWarnings((prev) => [...prev, data.message]);
				console.log(data.message);
				return;
			}


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

	const handleRunDocumentLoaderNode = useCallback(
		async (triggerId: string) => {
			const res = await api.post(`/api/start-workflow/`, {
				node_id: id,
				trigger_id: triggerId,
				input: chatInput,
			});
			console.log(res.data);
		},
  [id] // dependencies that affect this function
  );


	const getAgents = useCallback(async (): Promise<void> => {
		try {
			const { data } = await api.get(`api/workflow/${id}/agents/`);
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

				return {
					id: agentData.slug,
					type: agentData.type,
					data: {
						...agentData,
						next_agents,
						memory_node,
						chat_model_node,
						retriever_node,
						...(agentData.type === "chatTrigger" ? { onOpenChat: handleOpenChat } : {}),
						status: 'pending',
						onDelete: handleDeleteNode,
						flowType: getFlowType(agentData.type),
						onRun: handleRunDocumentLoaderNode,
					},
					position: {
						x: agentData.properties.position_x,
						y: agentData.properties.position_y,
					},
				} as AgentNode;
			});

			// const activeChatAgent = agents.find((agent) => agent.data.type === 'chatTrigger');
			// if (activeChatAgent) {
			// 	handleOpenChat(activeChatAgent.id);
			// }

			setAgents(agents);
			const newEdges: Edge[] = [];
			agents.forEach((agent) => {
      			// Next Agents: no special handle.
				agent.data.next_agents?.forEach((target: string) => {
					newEdges.push({
						id: uuidv4(),
						source: agent.id,
						target,
						animated: true,
						style: { stroke: '#f6ab6c', strokeDasharray: '5,5' },
					});
				});

      			// Memory Node: use memory prefix on both source and target.
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

      			// Chat Model Node: use chatModel prefix.
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

      			// Retriever Node: use retriever prefix.
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
		handleDeleteNode,
		handleOpenChat,
		id,
		setAgents,
		setEdges,
		getFlowType,
		handleRunDocumentLoaderNode
		]);



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

			let connectionType = 'next';

			if (sourceAgent && targetAgent) {
			  // Determine the connection type based on target agent type.
				if (targetAgent.type === 'memory') {
					connectionType = 'memory';
				} else if (targetAgent.type === 'chatModel') {
					connectionType = 'chat_model';
				} else if (targetAgent.type === 'vectorStore') {
					if (targetHandle?.split("-")[0] === 'main') {
						connectionType = 'next'
					}
					else if (targetHandle?.split("-")[0] === 'retriever') {
						connectionType = 'retriever';
					}
				} else {
					connectionType = 'next';
				}

			  // Create the payload according to the serializer's expected fields.
				const payload = {
					connection_type: connectionType,
				source: sourceAgent.id,  // ensure this is the agent's unique identifier
				target: targetAgent.id,  // ensure this is the agent's unique identifier
			};

			  // Send the payload to the connection creation endpoint.
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

		// node.data.properties.memories?.push(newMemory);
		setMemories((prevMemories) => [...prevMemories, newMemory]);
		const triggerId = activeNode?.id;
		console.log('trigger id: ', triggerId);
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
  <div className="h-screen overflow-hidden flex flex-col bg-gray-900 text-gray-100">
    {/* Navbar */}
    <header className="h-16 p-4 flex justify-between items-center border-b border-gray-700">
      <a href="/">
        <h1 className="text-2xl">AI Workflow Automation</h1>
      </a>
      <div className="flex space-x-10">
        <a className="text-lg" href="/profile">Profile</a>
        <a className="text-lg" href="/logout">Logout</a>
      </div>
    </header>

    {/* Remaining space divided into 2 rows (equal height) & 2 columns */}
    <div className="flex-1 grid grid-rows-2 grid-cols-[75%_25%]">
      
      {/* Top Left: ReactFlow Component */}
      <div className="border border-gray-700 p-2">
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
		  <Controls
		    showZoom
		    showFitView
		    showInteractive={false}
		    position="bottom-left"
		    style={{
		      flexDirection: "row",
		      gap: "8px",
		      backgroundColor: "transparent",
		      padding: "8px",
		      borderRadius: "8px",
		    }}
		  />
		  <Background gap={12} size={1} />
		</ReactFlow>

      </div>
      
      {/* Top Right: Console */}
      <div className="border border-gray-700 bg-gray-800 text-gray-100 p-4 overflow-y-auto">
        {/* Insert dynamic console logs here */}
        <p>Console output will appear here...</p>
      </div>
      
      {/* Bottom Left: Chat Window */}
      <div className="border border-gray-700 flex flex-col">
        {/* Chat Messages Area */}
        <div className="flex-1 p-4 overflow-y-auto">
          <h1 className="text-2xl mb-2">Chat</h1>
          {activeNode && (
            <div className="text-sm text-gray-400 mb-4">
              Session {activeNode.id}
            </div>
          )}
          {memories?.map((memory: MemoryItem, index) => {
            const lastContent = memory.content[memory.content.length - 1]?.text;
            return (
              <div key={index} className="mb-4">
                {memory.role === 'user' && (
                  <div className="flex justify-start">
                    <div className="w-[40%] bg-gray-800 text-gray-100 p-4 rounded-xl">
                      {lastContent}
                    </div>
                  </div>
                )}
                {memory.role === 'assistant' && (
                  <div className="flex justify-end">
                    <div className="w-[40%] bg-gray-700 text-gray-100 p-4 rounded-xl">
                      {lastContent}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {/* Chat Input */}
        <div className="p-4 border-t border-gray-700">
          <form onSubmit={handleSubmitChat}>
            <input
              type="text"
              className="border border-gray-600 rounded-lg p-2 w-full bg-gray-800 text-gray-100"
              value={chatInput}
              onChange={handleUpdateChatInput}
              placeholder="Type your message..."
            />
          </form>
        </div>
      </div>
      
      {/* Bottom Right: File Upload */}
      <div className="border border-gray-700 p-4">
        <div className="border-2 border-dashed border-gray-600 h-full flex items-center justify-center relative bg-gray-800">
          <p className="mb-2 text-center">Drag and drop files here or click to upload</p>
          <input
            type="file"
            multiple
            className="absolute w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>
      
    </div>
    
    {/* Optional Run button overlay */}
    <button
      className="absolute top-4 right-4 z-50 rounded-md border border-gray-600 p-2 hover:bg-gray-700 hover:text-white"
    >
      Run
    </button>
  </div>
);



};

const FlowProvider: React.FC = () => (
	<ReactFlowProvider>
	<Workflow/>
	</ReactFlowProvider>
	);

export default FlowProvider;