import {useCallback, useState} from 'react';
import {Handle, Position} from '@xyflow/react';
import Modal from "./Modal.tsx";
import api from "../api.ts";
import {node} from "globals";

const handleStyle = {left: 10};

const openModal = (e) => {

}

function AskAINode({data, id}) {
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
                <div className="bg-pink-200 rounded-xl p-4">
                    <div className="flex space-x-4 items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                             stroke="currentColor" className="size-6">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
                        </svg>
                        <h2 className="text-2xl">Ask AIr</h2>
                    </div>
                    <p className="text-xs mt-4">Prompt an AI language model. Provide all relevant context and use
                        detailed prompts to get the best results.</p>
                </div>

                <div className="py-8 border-b-1 border-gray-200">
                    <div className="flex space-x-2 items-center">
                        <p className="font-bold">Prompt</p>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                             stroke="currentColor" className="size-4">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"/>
                        </svg>
                    </div>
                    <input type="text" className="block border-1 border-gray-400 rounded-lg p-2 w-full mt-2"
                           placeholder="What are the main features of the alfresco documentation system"/>
                </div>

                <div className="py-8 border-b-1 border-gray-200">
                    <div className="flex space-x-2 items-center">
                        <p className="font-bold">Context</p>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                             stroke="currentColor" className="size-4">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"/>
                        </svg>
                    </div>
                    <textarea className="block border-1 border-gray-400 rounded-lg p-2 w-full mt-2"
                              placeholder="[Optional] This is additional context for the AI model that can be referenced in the prompt"/>
                </div>

                <div className="py-8 border-b-1 border-gray-200">
                    <div className="flex space-x-2 items-center">
                        <p className="font-bold">Choose AI Model</p>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                             stroke="currentColor" className="size-4">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"/>
                        </svg>
                    </div>
                    <form className="max-w-sm mt-2 w-[calc(80%)]">
                        <select id="image-models"
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                            <option value="" selected>Claude 3 Haiku</option>
                            <option value="CA">GPT-4o</option>
                            <option value="FR">GPT-40 mini</option>
                            <option value="DE">OpenAI o1</option>
                        </select>
                    </form>
                </div>

                <Modal
                    id={id}
                    isOpen={isModalOpen}
                    onClose={handleCloseModal}
                    onSubmit={handleSubmitProblems}
                />
            </div>
            <Handle type="source" position={Position.Bottom} id="a"/>
            {/*<Handle*/}
            {/*    type="source"*/}
            {/*    position={Position.Bottom}*/}
            {/*    id="b"*/}
            {/*    style={handleStyle}*/}
            {/*/>*/}
        </>
    );
}

export default AskAINode;