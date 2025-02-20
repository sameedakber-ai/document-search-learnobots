import {
    ChangeEvent,
    useCallback,
    useState,
    FC
} from 'react';
import {Handle, Position, NodeProps, XYPosition} from '@xyflow/react';
import {createPortal} from 'react-dom';
import DocumentUploaderModal from './DocumentUploaderModal';
import {DocumentType} from "./CustomLessonFlow";

export interface NodeData {
    [key: string]: unknown;
    label: string;
    documents: DocumentType[];
    selectedDocuments: DocumentType[];
    imageModel: string;
    temperature: number;
    extractImages: boolean;
    onDelete?: (nodeId: string) => void;
    onChange?: (nodeId: string, changes: Partial<NodeData>) => void;
    onDocumentsChange?: () => void;
}

export interface DocumentUploaderData extends Record<string, unknown> {
    id: string,
    position: XYPosition,
    data: NodeData
}

export type DocumentUploaderNodeProps = NodeProps<DocumentUploaderData>;

const DocumentUploaderNode: FC<DocumentUploaderNodeProps> = ({id, data}) => {
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

    const [imageModel, setImageModel] = useState<string>(data.imageModel);
    const [temperature, setTemperature] = useState<number>(data.temperature);
    const [extractImages, setExtractImages] = useState<boolean>(data.extractImages);

    const handleOpenModal = useCallback((): void => setIsModalOpen(true), []);
    const handleCloseModal = useCallback((): void => setIsModalOpen(false), []);

    // Delete node callback
    const handleDeleteClick = useCallback((): void => {
        if (data.onDelete) {
            data.onDelete(id);
        }
    }, [data, id]);

    // Change handlers – these update local state and call the parent's onChange callback.
    const onImageModelChange = useCallback((evt: ChangeEvent<HTMLSelectElement>): void => {
        const updated = evt.target.value;
        setImageModel(updated);
        if (data.onChange) {
            data.onChange(id, {imageModel: updated});
        }
    }, [data, id]);

    const onTemperatureChange = useCallback((evt: ChangeEvent<HTMLInputElement>): void => {
        const updated = parseFloat(evt.target.value) || 0;
        setTemperature(updated);
        if (data.onChange) {
            data.onChange(id, {temperature: updated});
        }
    }, [data, id]);

    const onExtractImagesChange = useCallback((evt: ChangeEvent<HTMLInputElement>): void => {
        const updated = evt.target.checked;
        setExtractImages(updated);
        if (data.onChange) {
            data.onChange(id, {extractImages: updated});
        }
    }, [data, id]);


    const handleUpdateSelectedDocuments = useCallback((docs: DocumentType[]): void => {
        if (data.onChange) {
            data.onChange(id, {selectedDocuments: docs});
        }
    }, [data, id]);

    return (
        <>
            <Handle type="target" position={Position.Top}/>
            <div className="border-3 border-orange-600 rounded-xl relative p-1 w-96 bg-white">
                <div className="absolute right-2 top-2" onClick={handleDeleteClick}>
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        className="size-8"
                    >
                        <path
                            fillRule="evenodd"
                            d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm-1.72 6.97a.75.75 0 1 0-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L12 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L13.06 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L12 10.94l-1.72-1.72Z"
                            clipRule="evenodd"
                        />
                    </svg>
                </div>
                <div className="bg-orange-200 rounded-xl p-4">
                    <div className="flex space-x-4 items-center">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                            className="size-6"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                            />
                        </svg>
                        <h2 className="text-2xl">Document Loader</h2>
                    </div>
                    <p className="text-xs mt-4">
                        Extract text content from documents. Supported document types are PDF,
                        DOCX, JSON, TEXT and MD.
                    </p>
                </div>
                <div className="py-8 border-b-1 border-gray-200">
                    <div className="flex space-x-2 items-center">
                        <p className="font-bold">Select Documents</p>
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
                    <button
                        className="flex space-x-2 rounded-full px-4 py-1 items-center bg-gray-200 mt-2"
                        id="menu-button"
                        aria-expanded="true"
                        aria-haspopup="true"
                        onClick={handleOpenModal}
                    >
                        <div>
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
                                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                                />
                            </svg>
                        </div>
                        <div>Open</div>
                    </button>
                </div>

                <div className="py-8 border-b-1 border-gray-200">
                    <div className="flex space-x-2 items-center">
                        <p className="font-bold">Image model Preference</p>
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
                    <form className="max-w-sm mt-2 w-[calc(80%)]">
                        <select
                            id="image-models"
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                            value={imageModel}
                            onChange={onImageModelChange}
                        >
                            <option value="gpt-3o">GPT-3o Vision</option>
                            <option value="GPT-4o">GPT-4o Vision</option>
                            <option value="gpt-4o-mini">GPT 4o Mini</option>
                            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                        </select>
                    </form>
                </div>

                <div className="py-8 border-b-1 border-gray-200">
                    <div className="flex space-x-2 items-center">
                        <p className="font-bold">Temperature</p>
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
                    <input
                        type="text"
                        className="block border-1 border-gray-400 rounded-lg p-2 w-24 mt-2"
                        value={temperature}
                        onChange={onTemperatureChange}
                    />
                </div>

                <div className="py-8 border-b-1 border-gray-200">
                    <div className="flex space-x-2 items-center">
                        <p className="font-bold">Extract Images?</p>
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
                    <input
                        type="checkbox"
                        checked={extractImages}
                        onChange={onExtractImagesChange}
                        className="w-5 h-5 rounded-md mt-2"
                    />
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} id="a"/>
            {createPortal(
                <DocumentUploaderModal
                    id={id}
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    documents={data.documents}
                    onDocumentsChange={data.onDocumentsChange}
                    selectedDocuments={data.selectedDocuments}
                    onChange={handleUpdateSelectedDocuments}
                />,
                document.body
            )}
        </>
    );
};

export default DocumentUploaderNode;
