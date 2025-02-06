import React, {useEffect, useState} from 'react';
import api from "../api.ts";
import FileUpload from "./FileUpload.tsx";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (problems: string[]) => void;
    id: string;
}

const DocumentUploaderModal: React.FC<ModalProps> = ({isOpen, onClose, onSubmit, id}) => {
    const [problems, setProblems] = useState<string[]>(['']); // Start with one input field
    const [description, setDescription] = useState<string>('');
    const [documents, setDocuments] = useState([]);
    const [showFileSelector, setShowFileSelector] = useState(false);

    useEffect(() => {
        getDocuments();
    }, []);

    const getDocuments = () => {
        api.get('/api/documents/')
            .then((res) => res.data)
            .then((data) => {
                setDocuments([]);
                data.map((nodeData) => {
                    const newDocument = {
                        id: nodeData.id,
                        name: nodeData.name,
                        date: nodeData.date,
                        extension: nodeData.file.split('.').pop(),
                    };
                    setDocuments((documents) => [...documents, newDocument]);
                });
            })
            .catch((error) => alert(error));
    }

    const handleProblemChange = (index: number, value: string) => {
        const updatedProblems = [...problems];
        updatedProblems[index] = value;
        setProblems(updatedProblems);
    };

    const addProblemField = () => {
        if (problems.length < 5) {
            setProblems([...problems, '']);
        }
    };

    const handleDescriptionChange = (e) => {
        setDescription(e.target.value);
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log(problems);
        api.post('/api/node/create/', {
            slug: id, description: description, problems: problems.map((problem) => {
                return {'question': problem}
            })
        })
            .then((res) => res.data)
            .then((data) => console.log(data))
            .catch((error) => alert(error));
        onClose(); // Close modal after submission
    };

    if (!isOpen) return null; // Don't render the modal if it's not open

    const handleOpenFileSelector = (e) => {
        e.preventDefault();
        setShowFileSelector(!showFileSelector);
    }

    return (
        <div
            className="fixed inset-[calc(10%)] flex items-center justify-center z-50"
        >
            <div className="rounded-xl p-6 shadow-lg bg-white max-h-[calc(700px)] overflow-y-auto">
                <div className="flex justify-between">
                    <h1 className="text-2xl font-semibold">
                        Your Uploaded Files
                    </h1>
                    <button onClick={onClose}>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                             stroke="currentColor" className="size-6">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
                        </svg>

                    </button>
                </div>
                <div className="flex space-x-4 mt-8">
                    <button className="text-sm bg-red-200 px-2 py-1 rounded-full hover:bg-red-500">pdf
                    </button>
                    <button className="text-sm bg-green-200 px-2 py-1 rounded-full hover:bg-green-500">docx
                    </button>
                    <button className="text-sm bg-amber-200 px-2 py-1 rounded-full hover:bg-amber-500">md
                    </button>
                    <button className="text-sm bg-blue-200 px-2 py-1 rounded-full hover:bg-blue-500">txt
                    </button>
                </div>


                <div className="relative overflow-x-auto max-h-[calc(300px)] overflow-y-scroll mt-4">
                    <table className="w-full text-sm text-left rtl:text-right">
                        <thead
                            className="text-xs uppercase bg-gray-50">
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
                        {documents.map((document, index) => (
                            <tr className="bg-white border-b border-gray-200">
                                <th scope="row"
                                    className="px-6 py-4 font-medium whitespace-nowrap">
                                    {document.name}
                                </th>
                                <td className="px-6 py-4">
                                    {document.extension}
                                </td>
                                <td className="px-6 py-4">
                                    {document.date}
                                </td>
                                <td className="px-6 py-4">
                                    <input type="checkbox" className="w-5 h-5 rounded-xl mt-2" placeholder="" value={document.id} onSelect={handleSelectDocument}/>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>

                <button
                    className="py-2 px-4 bg-red-100 rounded-md border-1 border-red-600 flex space-x-4 text-red-600 mt-16" onClick={handleOpenFileSelector}>
                    <div>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                             stroke="currentColor" className="size-6">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m6.75 12-3-3m0 0-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"/>
                        </svg>
                    </div>
                    <div>{showFileSelector ? 'Cancel Select Files' : 'Pick files to upload'}</div>
                </button>

                {showFileSelector && (
                    <FileUpload/>
                )}

                {/*<form onSubmit={handleSubmit} className="mt-8">*/}
                {/*    <h2 className="text-lg font-semibold mb-4">Add description</h2>*/}
                {/*    <input*/}
                {/*        type="text"*/}
                {/*        value={description}*/}
                {/*        onChange={handleDescriptionChange}*/}
                {/*        placeholder="Node description"*/}
                {/*        className="w-full border border-gray-300 rounded-md p-2"*/}
                {/*    />*/}
                {/*    <h2 className="text-lg font-semibold mb-4 mt-8">Add Problems</h2>*/}
                {/*    {problems.map((problem, index) => (*/}
                {/*        <div key={index} className="mb-2">*/}
                {/*            <input*/}
                {/*                type="text"*/}
                {/*                value={problem}*/}
                {/*                onChange={(e) => handleProblemChange(index, e.target.value)}*/}
                {/*                placeholder={`Problem ${index + 1}`}*/}
                {/*                required*/}
                {/*                className="w-full border border-gray-300 rounded-md p-2"*/}
                {/*            />*/}
                {/*        </div>*/}
                {/*    ))}*/}
                {/*    {problems.length < 5 && (*/}
                {/*        <button*/}
                {/*            type="button"*/}
                {/*            onClick={addProblemField}*/}
                {/*            className="mt-2 text-green-500 hover:underline"*/}
                {/*        >*/}
                {/*            + Add Another Problem*/}
                {/*        </button>*/}
                {/*    )}*/}
                {/*    <div className="mt-4 flex justify-between">*/}
                {/*        <button*/}
                {/*            type="submit"*/}
                {/*            className="bg-green-500 text-white rounded-md px-4 py-2 hover:bg-green-600"*/}
                {/*        >*/}
                {/*            Submit*/}
                {/*        </button>*/}
                {/*        <button*/}
                {/*            type="button"*/}
                {/*            className="bg-red-500 text-white rounded-md px-4 py-2 hover:bg-red-600"*/}
                {/*            onClick={onClose}*/}
                {/*        >*/}
                {/*            Close*/}
                {/*        </button>*/}
                {/*    </div>*/}
                {/*</form>*/}
            </div>
        </div>
    );
};

export default DocumentUploaderModal;
