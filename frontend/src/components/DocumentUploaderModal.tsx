import {useEffect, useState, useCallback, FC, ChangeEvent, MouseEvent} from 'react';
import {createPortal} from 'react-dom';
import api from '../api';
import FileUpload from './FileUpload';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    id: string;
    documents: DocumentType[];
    // onDocumentsChange: (docs: DocumentType[]) => void;
}

const DocumentUploaderModal: FC<ModalProps> = ({
                                                   isOpen,
                                                   onClose,
                                                   id,
                                                   documents
                                               }) => {
    const [showFileSelector, setShowFileSelector] = useState<boolean>(false);
    const [localDocuments, setLocalDocuments] = useState<DocumentType[]>(documents);

    useEffect(() => {
        setLocalDocuments(documents);
    }, [documents]);

    useEffect(() => {
        console.log(documents);
    }, [documents]);

    const handleOpenFileSelector = useCallback((e: MouseEvent<HTMLButtonElement>): void => {
        e.preventDefault();
        setShowFileSelector((prev) => !prev);
    }, []);

    // const handleCheckboxChange = useCallback(
    //     (evt: ChangeEvent<HTMLInputElement>): void => {
    //         const docId = evt.target.value;
    //         const checked = evt.target.checked;
    //         let updatedSelection: string[];
    //         if (checked) {
    //             updatedSelection = [...selectedDocuments, docId];
    //         } else {
    //             updatedSelection = selectedDocuments.filter((id) => id !== docId);
    //         }
    //         onDocumentsChange(updatedSelection);
    //     },
    //     [selectedDocuments, onDocumentsChange]
    // );

    // If the modal is not open, render nothing.
    if (!isOpen) {
        return null;
    }

    return createPortal(
        <div className="fixed inset-[calc(10%)] flex items-center justify-center z-50">
            <div className="rounded-xl p-6 shadow-lg bg-white max-h-[calc(700px)] overflow-y-auto">
                <div className="flex justify-between">
                    <h1 className="text-2xl font-semibold">Your Uploaded Files</h1>
                    <button onClick={onClose}>
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
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
                <div className="flex space-x-4 mt-8">
                    <button className="text-sm bg-red-200 px-2 py-1 rounded-full hover:bg-red-500">
                        pdf
                    </button>
                    <button className="text-sm bg-green-200 px-2 py-1 rounded-full hover:bg-green-500">
                        docx
                    </button>
                    <button className="text-sm bg-amber-200 px-2 py-1 rounded-full hover:bg-amber-500">
                        md
                    </button>
                    <button className="text-sm bg-blue-200 px-2 py-1 rounded-full hover:bg-blue-500">
                        txt
                    </button>
                </div>

                <div className="relative overflow-x-auto max-h-[calc(300px)] overflow-y-scroll mt-4">
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
                                Selected?
                            </th>
                        </tr>
                        </thead>
                        <tbody>
                        {localDocuments.map((document) => (
                            <tr key={document.id} className="bg-white border-b border-gray-200">
                                <th
                                    scope="row"
                                    className="px-6 py-4 font-medium whitespace-nowrap"
                                >
                                    {document.name}
                                </th>
                                <td className="px-6 py-4">{document.extension}</td>
                                <td className="px-6 py-4">{document.date}</td>
                                <td className="px-6 py-4">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded-xl mt-2"
                                        value={document.id}
                                    />
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                <button
                    className="py-2 px-4 bg-red-100 rounded-md border border-red-600 flex space-x-4 text-red-600 mt-16"
                    onClick={handleOpenFileSelector}
                >
                    <div>
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
                                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                            />
                        </svg>
                    </div>
                    <div>
                        {showFileSelector ? 'Cancel Select Files' : 'Pick files to upload'}
                    </div>
                </button>

                {showFileSelector && <FileUpload id={id}/>}
            </div>
        </div>,
        document.body
    );
};

export default DocumentUploaderModal;
