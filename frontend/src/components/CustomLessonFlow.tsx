import React, {
    useCallback,
    useState,
    useEffect,
    ChangeEvent,
    FormEvent,
} from 'react';
import {
    ReactFlowProvider,
    ReactFlow,
    useNodesState,
    useEdgesState,
    addEdge,
    Node,
    Edge,
    OnConnectParams,
} from '@xyflow/react';
import TextUpdaterNode from './TextUpdaterNode';
import DocumentUploaderNode from './DocumentUploaderNode';
import AskAINode from './AskAINode';
import {v4 as uuidv4} from 'uuid';
import dagre from "dagre";
import '@xyflow/react/dist/style.css';
import api from '../api';

interface NodeData {
    slug: string;
    type: string;
    label: string;
    position_x: number;
    position_y: number;
    image_model: string;
    temperature: number;
    extract_images: boolean;
}

interface EdgeData {
    slug: string;
    source_id: string;
    target_id: string;
}

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

const nodeTypes = {
    textUpdater: TextUpdaterNode,
    documentLoader: DocumentUploaderNode,
    askAI: AskAINode,
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

// const getLayoutedElements = (
//     nodes: Node[],
//     edges: Edge[],
//     direction: 'TB' | 'LR' = 'TB'
// ): { nodes: Node[]; edges: Edge[] } => {
//     const nodeWidth = 172;
//     const nodeHeight = 36;
//
//     dagreGraph.setGraph({rankdir: direction});
//
//     nodes.forEach((node) => {
//         dagreGraph.setNode(node.id, {width: nodeWidth, height: nodeHeight});
//     });
//
//     edges.forEach((edge) => {
//         dagreGraph.setEdge(edge.source, edge.target);
//     });
//
//     dagre.layout(dagreGraph);
//
//     const layoutedNodes = nodes.map((node) => {
//         const nodeWithPosition = dagreGraph.node(node.id);
//         return {
//             ...node,
//             position: {
//                 x: nodeWithPosition.x - nodeWidth / 2,
//                 y: nodeWithPosition.y - nodeHeight / 2,
//             },
//         };
//     });
//
//     return {nodes: layoutedNodes, edges};
// };

const LayoutFlow: React.FC = () => {
    const [nodeName, setNodeName] = useState<string>('');
    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
    const [pendingChanges, setPendingChanges] = useState<Record<string, Partial<DocumentUploaderData>>>({});

    useEffect(() => {
        getNodes();
        getEdges();
    }, []);

    const handleNodeChange = useCallback((nodeId: string, changes: Partial<DocumentUploaderData>) => {
        setPendingChanges((prev) => ({
            ...prev,
            [nodeId]: {
                ...prev[nodeId],
                ...changes,
            },
        }));
    }, []);

    // Delete node callback passed to node components
    const handleDeleteNode = useCallback((nodeId: string) => {
        // Optionally, call your backend API to delete the node
        api
            .delete(`/api/node/${nodeId}/delete/`)
            .then(() => {
                setNodes((nds) => nds.filter((node) => node.id !== nodeId));
            })
            .catch((error) => alert(error));
    }, [setNodes]);

    const getNodes = (): void => {
        api
            .get('/api/nodes/')
            .then((res) => res.data)
            .then((data: NodeData[]) => {
                setNodes([]);
                data.forEach((nodeData) => {
                    const newNode: Node = {
                        id: nodeData.slug,
                        type: nodeData.type,
                        data: {
                            label: nodeData.label,
                            imageModel: nodeData.image_model,
                            onChange: handleNodeChange,
                            onDelete: handleDeleteNode,
                            temperature: nodeData.temperature,
                            extractImages: nodeData.extract_images
                        },
                        position: {x: nodeData.position_x, y: nodeData.position_y},
                    };
                    setNodes((prevNodes) => [...prevNodes, newNode]);
                });
            })
            .catch((error: unknown) => console.log(error));
    };

    const getEdges = (): void => {
        api
            .get('/api/edges/')
            .then((res) => res.data)
            .then((data: EdgeData[]) => {
                data.forEach((edgeData) => {
                    const newEdge: Edge = {
                        id: edgeData.slug,
                        source: edgeData.source_id,
                        target: edgeData.target_id,
                        animated: true,
                        style: {stroke: '#f6ab6c', strokeDasharray: '10,10'},
                    };
                    setEdges((prevEdges) => [...prevEdges, newEdge]);
                });
            })
            .catch((error: unknown) => console.log(error));
    };

    const onConnect = useCallback(
        (params: OnConnectParams) => {
            const {source, target} = params;

            // Helper function to check if a circular edge is created
            const isCircular = (sourceId: string, targetId: string, edges: Edge[]): boolean => {
                const visited = new Set<string>();
                const stack = [targetId];

                while (stack.length > 0) {
                    const current = stack.pop();
                    if (current === sourceId) {
                        return true;
                    }
                    visited.add(current!);
                    edges.forEach((edge) => {
                        if (edge.source === current && !visited.has(edge.target)) {
                            stack.push(edge.target);
                        }
                    });
                }
                return false;
            };

            // Helper function to check if the target node already has a parent
            const hasParent = (targetId: string, edges: Edge[]): boolean => {
                return edges.some((edge) => edge.target === targetId);
            };

            if (!isCircular(source, target, edges) && !hasParent(target, edges)) {
                const id = uuidv4();
                api
                    .post('/api/edge/create/', {slug: id, source_id: source, target_id: target})
                    .then((res) => res.data)
                    .then((data) => console.log(data))
                    .catch((error) => alert(error));
                setEdges((eds) =>
                    addEdge(
                        {
                            ...params,
                            id: id,
                            animated: true,
                            style: {stroke: '#f6ab6c', strokeDasharray: '5,5'},
                        },
                        eds
                    )
                );
            } else if (hasParent(target, edges)) {
                alert('A node cannot have more than one parent!');
            } else {
                alert('Circular connection is not allowed!');
            }
        },
        [edges, setEdges]
    );

    const setNewNode = (e: FormEvent<HTMLFormElement>): void => {
        e.preventDefault();
        const slug = uuidv4();
        api
            .post('/api/node/create/', {
                slug: slug,
                type: nodeName,
                canvas_id: 1,
                position_x: 0,
                position_y: 0,
                label: nodeName,
            })
            .then((res) => res.data)
            .then(() => {
                const newNode: Node = {
                    id: slug,
                    type: nodeName,
                    data: {
                        label: nodeName || 'New Node',
                        onChange: handleNodeChange,
                        onDelete: handleDeleteNode,
                        imageModel: 'gpt-3o',
                        temperature: 1,
                        extractImages: false
                    },
                    position: {x: 0, y: 0},
                };
                setNodes((prevNodes) => [...prevNodes, newNode]);
                setNodeName('');
            })
            .catch((error) => alert(error));
    };

    // useEffect(() => {
    //   const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
    //     nodes,
    //     edges
    //   );
    //   setNodes([...layoutedNodes]);
    //   setEdges([...layoutedEdges]);
    // }, [nodes, edges, setNodes, setEdges]);

    const handleSaveSettings = useCallback(() => {
        // Iterate over pendingChanges and save them
        Object.entries(pendingChanges).forEach(([nodeId, changes]) => {
            api.post(`/api/node/${nodeId}/update/`, {...changes})
                .then((res) => res.data)
                .then((data) => console.log(`Saved node ${nodeId}: `, data))
                .catch((error) => console.error(error));
        });
        // Optionally clear pending changes after saving
        setPendingChanges({});
    }, [pendingChanges]);

    const handleNodeNameChange = (e: ChangeEvent<HTMLInputElement>): void => {
        setNodeName(e.target.value);
    };

    return (
        <div>
            <div className="flex justify-between px-4">
                <form onSubmit={setNewNode}>
                    <div className="flex space-x-2 items-center">
                        <input
                            className="p-2 rounded-md border-2 border-gray-500"
                            type="text"
                            value={nodeName}
                            onChange={handleNodeNameChange}
                            placeholder="Enter node type"
                        />
                        <button className="p-2 bg-black text-white text-sm rounded-md" type="submit">
                            Create
                        </button>
                    </div>
                </form>
                <button
                    className="px-4 py-3 rounded-lg bg-gray-200 hover:bg-gray-400"
                    onClick={handleSaveSettings}
                >
                    Save
                </button>
            </div>
            <div style={{width: '100vw', height: '100vh'}}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    nodeTypes={nodeTypes}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    fitView
                />
            </div>
        </div>
    );
};

const FlowProvider: React.FC = () => {
    return (
        <ReactFlowProvider>
            <LayoutFlow/>
        </ReactFlowProvider>
    );
};

export default FlowProvider;
