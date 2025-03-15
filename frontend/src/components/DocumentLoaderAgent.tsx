import {XYPosition, Node, NodeProps, Position, Handle} from "@xyflow/react";
import {FC, useCallback, useEffect, useState} from "react";
import {createPortal} from "react-dom";
import DocumentLoaderModal from "./DocumentLoaderModal.tsx";
import api from "../api.ts";
import {FileType} from "./Workflow.tsx";

export interface FileResponse {
    id: string;
    file: string;
    date: string;
}

export interface DocumentLoaderProperties {
    files: FileType[];
    embedding_model: string;
}

export interface NodeData {
    [key: string]: unknown;

    slug: string;
    type: 'documentLoader';
    workflow: string;
    next_agents?: string[];
    position_x: number;
    position_y: number;
    properties: DocumentLoaderProperties
}

export interface DocumentLoaderAgentNode extends Node {
    id: string;
    type: string;
    data: NodeData;
    position: XYPosition
}

export type DocumentLoaderAgentNodeProps = NodeProps<DocumentLoaderAgentNode>

const DocumentLoaderAgent: FC<DocumentLoaderAgentNodeProps> = ({id, data}) => {
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const handleOpenModal = useCallback((): void => setIsModalOpen(true), []);
    const handleCloseModal = useCallback((): void => setIsModalOpen(false), []);

    const [files, setFiles] = useState<FileType[]>(data.properties.files);

    const handleUpdateFiles = async () => {
        try {
            const res = await api.get(`/api/${id}/files/`);
            const files: FileType[] = res.data.map((file: FileResponse) => ({
                id: file.id,
                name: file.file.replace(/^.*[\\/]/, ''),
                extension: file.file.split('.').pop(),
                date: file.date
            }));
            setFiles(files);
        } catch (error) {
            alert(error);
        }
    }

    useEffect(() => {
        handleUpdateFiles().then(r => console.log(r));
    }, []);

    return (
        <>
            <Handle type="target" position={Position.Left}/>
            <div className="rounded-xl flex justify-center items-center p-4 border-1">
                <button onClick={handleOpenModal}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                         stroke="currentColor" className="size-6">
                        <path stroke-linecap="round" stroke-linejoin="round"
                              d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
                    </svg>
                </button>
            </div>
            <Handle type="source" position={Position.Right} id="a"/>
            {createPortal(
                <DocumentLoaderModal
                    id={id}
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    files={files}
                    data={data}
                    onFilesUpdate={handleUpdateFiles}
                />,
                document.body
            )}
        </>
    )

}

export default DocumentLoaderAgent;



