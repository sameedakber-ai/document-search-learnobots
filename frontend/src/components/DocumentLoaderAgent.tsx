import { NodeProps, Position, Handle } from "@xyflow/react";
import { FC, useState, useRef, ChangeEvent, DragEvent } from "react";

import { AgentNode } from "../nodeTypes";
import BaseNode from "./BaseNode";
import api from "../api";
// Make sure to import your API client, e.g.:
// import api from '../api';

export type DocumentLoaderAgentNodeProps = NodeProps<AgentNode<"documentLoader">>;

const DocumentLoaderAgent: FC<DocumentLoaderAgentNodeProps> = (props) => {
    const { id, data } = props;
    const [files, setFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Called when files are selected via the file input
    const handleFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            const selectedFiles = Array.from(event.target.files);
            setFiles(selectedFiles);
            uploadFiles(selectedFiles);
        }
    };

    // Called when files are dropped onto the dropzone
    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
            const droppedFiles = Array.from(event.dataTransfer.files);
            setFiles(droppedFiles);
            uploadFiles(droppedFiles);
            event.dataTransfer.clearData();
        }
    };

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault();
    };

    // Upload files one by one and simulate upload progress
    const uploadFiles = async (filesToUpload: File[]) => {
        if (filesToUpload.length === 0) return;

        setIsUploading(true);
        let totalProgress = 0;

        for (let i = 0; i < filesToUpload.length; i++) {
            const file = filesToUpload[i];
            const formData = new FormData();
            formData.append("file", file);
            formData.append("nodeId", id);

            // Simulate file upload progress (10 steps per file)
            await new Promise<void>((resolve) => {
                const interval = setInterval(() => {
                    totalProgress += 100 / (filesToUpload.length * 10);
                    setUploadProgress(Math.min(totalProgress, 100));
                    if (totalProgress >= ((i + 1) / filesToUpload.length) * 100) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);
            });
            try {
                await api.post(`/api/${id}/files/upload/`, formData, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
            } catch (error) {
                console.log(error);
            }
        }

        setIsUploading(false);
        setUploadProgress(0);
        setFiles([]);

        // Trigger the onRun callback after upload completes.
        try {
            data.onRun(id);
        } catch (error) {
            console.error("Error triggering onRun:", error);
        }
    };

    return (
        <BaseNode {...props} classNames="rounded-l-2xl p-4">
            <div
                className="z-50 absolute -left-5 top-5"
                onClick={() => inputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="red"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                    className="size-5"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z"
                    />
                </svg>
            </div>
            <Handle
                type="source"
                position={Position.Right}
                id={`main-${id}-source`}
            />
        </BaseNode>
    );
};

export default DocumentLoaderAgent;