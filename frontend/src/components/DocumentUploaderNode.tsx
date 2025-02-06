import {useCallback, useEffect, useState} from 'react';
import {Handle, Position} from '@xyflow/react';
import Modal from "./Modal.tsx";
import {createPortal} from 'react-dom';

import api from "../api.ts";
import {node} from "globals";
import DocumentUploaderModal from "./DocumentUploaderModal.tsx";

const handleStyle = {left: 10};

const openModal = (e) => {

}

function DocumentUploaderNode({data, id}) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [nodeName, setNodeName] = useState(data.label);

    const handleOpenModal = () => setIsModalOpen(true);
    const handleCloseModal = () => setIsModalOpen(false);

    const onChange = useCallback((evt) => {
        const updatedName = evt.target.value;
        setNodeName(updatedName);

        console.log(evt.target.value);
        api.post(`/api/node/create/`, {slug: id, label: updatedName})
            .then((res) => res.data)
            .then((data) => console.log(data))
            .catch((error) => alert(error));
    }, []);

    const handleSubmitProblems = (problems: string[]) => {
        console.log('Problems:', problems);
        // Handle the submitted problems here (send them to the backend or process them)
    };

    return (
        <>
            <Handle type="target" position={Position.Top}/>
            <div className="border-3 border-orange-600 rounded-xl relative p-1 w-96 bg-white">
                <div className="bg-orange-200 rounded-xl p-4">
                    <div className="flex space-x-4 items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                             stroke="currentColor" className="size-6">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
                        </svg>
                        <h2 className="text-2xl">Document Loader</h2>
                    </div>
                    <p className="text-xs mt-4">Extract text content from documents. Supportted document types are PDF,
                        DOCX,
                        JSON, TEXT and MD.</p>
                </div>
                <div className="py-8 border-b-1 border-gray-200">
                    <div className="flex space-x-2 items-center">
                        <p className="font-bold">Select Documents</p>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                             stroke="currentColor" className="size-4">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"/>
                        </svg>
                    </div>
                    <button className="flex space-x-2 rounded-full px-4 py-1 items-center bg-gray-200 mt-2"
                            id="menu-button" aria-expanded="true" aria-haspopup="true" onClick={handleOpenModal}>
                        <div>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                                 stroke="currentColor" className="size-4">
                                <path stroke-linecap="round" stroke-linejoin="round"
                                      d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
                            </svg>
                        </div>
                        <div className="">
                            Open
                        </div>
                    </button>
                </div>

                <div className="py-8 border-b-1 border-gray-200">
                    <div className="flex space-x-2 items-center">
                        <p className="font-bold">Image model Preference</p>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                             stroke="currentColor" className="size-4">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"/>
                        </svg>
                    </div>
                    <form className="max-w-sm mt-2 w-[calc(80%)]">
                        <select id="image-models"
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                            <option value="" selected>GPT-4o Vision</option>
                            <option value="CA">GPT-4o Mini Vision</option>
                            <option value="FR">Claude 3.5 Sonnet</option>
                            <option value="DE">Gemini 1.5 Pro</option>
                        </select>
                    </form>
                </div>

                <div className="py-8 border-b-1 border-gray-200">
                    <div className="flex space-x-2 items-center">
                        <p className="font-bold">Temperature</p>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                             stroke="currentColor" className="size-4">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"/>
                        </svg>
                    </div>
                    <input type="text" className="block border-1 border-gray-400 rounded-lg p-2 w-24 mt-2"
                           placeholder="1"/>
                </div>

                <div className="py-8 border-b-1 border-gray-200">
                    <div className="flex space-x-2 items-center">
                        <p className="font-bold">Extract Images?</p>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                             stroke="currentColor" className="size-4">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"/>
                        </svg>
                    </div>
                    <input type="checkbox" className="w-5 h-5 rounded-md mt-2" placeholder="1"/>
                </div>
            </div>
            <Handle type="source" position={Position.Bottom} id="a"/>
            {createPortal(
                <DocumentUploaderModal
                    id={id}
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSubmit={handleSubmitProblems}
                />,
                document.body
            )}
        </>
    );
}

export default DocumentUploaderNode;