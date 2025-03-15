import {createPortal} from "react-dom";
import {ChangeEvent, FC, useState} from "react";
import FileUpload from "./FileUpload.tsx";
import {FileType} from "./Workflow.tsx";

import {NodeData} from "./DocumentLoaderAgent.tsx";
import api from "../api.ts";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    id: string;
    files: FileType[];
    onFilesUpdate: () => void;
    data: NodeData;
}

const embeddingModels = [
    {
        key: 1,
        label: 'OpenAI ada',
        value: 'text-embedding-ada-002',
        tokensPerDollar: 1000000
    },
    {
        key: 2,
        label: 'OpenAI 3 small',
        value: 'text-embedding-3-small',
        tokensPerDollar: 50000000
    },
    {
        key: 3,
        label: 'OpenAI 3 large',
        value: 'text-embedding-3-large',
        tokensPerDollar: 7692000
    }
];

const DocumentLoaderModal: FC<ModalProps> = ({
                                                 id,
                                                 isOpen,
                                                 onClose,
                                                 files,
                                                 onFilesUpdate,
                                                 data
                                             }) => {

    const [selectedTab, setSelectedTab] = useState<'file' | 'pdf' | 'general'>('file');
    const [embeddingModel, setEmbeddingModel] = useState<string>(data.properties.embedding_model);

    if (!isOpen) {
        return null;
    }

    const handleEmbeddingModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
        setEmbeddingModel(e.target.value);
    }

    const handleSaveAgent = async () => {
        const updatedData = data;
        updatedData.properties.embedding_model = embeddingModel;
        updatedData.slug = id;
        const res = await api.post('/api/agent/create/', updatedData);
        console.log(res.data);
    }

    return createPortal(
        <div className="fixed inset-[calc(10%)] flex items-center justify-center z-50">
            <div className="rounded-xl p-6 shadow-lg bg-white overflow-y-auto relative h-[calc(75vh)] w-[calc(80vw)]">
                <button className="absolute right-2 top-2" onClick={onClose}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                         stroke="currentColor" className="size-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
                    </svg>
                </button>

                <div className="flex h-full">
                    {/* Left column: Settings Headers */}
                    <div className="flex flex-col w-40 border-r border-gray-300 pr-4">
                        <button
                            className={`text-left py-2 px-2 rounded ${
                                selectedTab === 'file' ? 'bg-gray-200 font-bold' : 'hover:bg-gray-100'
                            }`}
                            onClick={() => setSelectedTab('file')}
                        >
                            File Selection
                        </button>
                        <button
                            className={`text-left py-2 px-2 rounded ${
                                selectedTab === 'pdf' ? 'bg-gray-200 font-bold' : 'hover:bg-gray-100'
                            }`}
                            onClick={() => setSelectedTab('pdf')}
                        >
                            PDF Processing
                        </button>
                        <button
                            className={`text-left py-2 px-2 rounded ${
                                selectedTab === 'general' ? 'bg-gray-200 font-bold' : 'hover:bg-gray-100'
                            }`}
                            onClick={() => setSelectedTab('general')}
                        >
                            General
                        </button>
                    </div>

                    {/* Right column: Settings Content Placeholder */}
                    <div className="flex-1 pl-4">
                        {
                            selectedTab === 'file' &&
                            <div className="relative overflow-x-auto overflow-y-scroll mt-4">
                                <table className="w-full text-sm text-left rtl:text-right">
                                    <thead className="text-xs uppercase bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">
                                            File name
                                        </th>
                                        <th scope="col" className="px-6 py-3">
                                            Type
                                        </th>
                                        <th scope="col" className="px-6 py-3">
                                            Date Added
                                        </th>
                                        <th scope="col" className="px-6 py-3">

                                        </th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {files.map((file) => (
                                        <tr key={file.id} className="bg-white border-b border-gray-200">
                                            <th
                                                scope="row"
                                                className="px-6 py-4 font-medium whitespace-nowrap"
                                            >
                                                {file.name}
                                            </th>
                                            <td className="px-6 py-4">{file.extension}</td>
                                            <td className="px-6 py-4">{file.date}</td>
                                            <td className="px-6 py-4">

                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                                <FileUpload id={id} onFilesUpdate={onFilesUpdate}/>
                            </div>
                        }
                        {
                            selectedTab === 'pdf' &&
                            (
                            <div className="relative overflow-x-auto overflow-y-auto">
                                <div className="mt-2">
                                    <div className="flex space-x-2 items-center">
                                        <p className="">Embedding model</p>
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            strokeWidth="1.5"
                                            stroke="currentColor"
                                            className="size-4"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
                                            />
                                        </svg>
                                    </div>
                                    <select
                                        id="image-models"
                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                        value={embeddingModel}
                                        onChange={handleEmbeddingModelChange}
                                    >
                                        {embeddingModels.map((model) => (
                                            <option value={model.value}>{model.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex justify-end mt-4">
                                    <button className="bg-emerald-100 rounded-lg p-2" onClick={handleSaveAgent}>Save</button>
                                </div>
                            </div>
                            )
                        }
                        {selectedTab === 'general' && <div>General settings go here.</div>}
                    </div>
                </div>

            </div>
        </div>,
        document.body
    );

}

export default DocumentLoaderModal;