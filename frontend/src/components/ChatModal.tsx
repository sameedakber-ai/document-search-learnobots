import {NodeData} from "./ChatAgent.tsx";
import {ChangeEvent, FC, useState} from "react";
import {createPortal} from "react-dom";
import api from "../api.ts";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    id: string;
    data: NodeData;
}

const textGenerationModels = [
    {
        key: 1,
        label: 'OpenAI GPT-4o',
        value: 'gpt-4o',
        tokensPerDollar: 1000000
    },
    {
        key: 2,
        label: 'OpenAI GPT-4o-mini',
        value: 'gpt-4o-mini',
        tokensPerDollar: 50000000
    },
    {
        key: 3,
        label: 'OpenAI o1',
        value: 'o1',
        tokensPerDollar: 7692000
    }
];

const ChatModal: FC<ModalProps> = ({id, data, isOpen, onClose}) => {
    const [textGenerationModel, setTextGenerationModel] = useState<string>(data.properties.generation_model);
    const [prompt, setPrompt] = useState<string>(data.properties.prompt);
    const [context, setContext] = useState<string>(data.properties.context);
    const [temperature, setTemperature] = useState<number>(data.properties.temperature);

    const handleTextGenerationModelChange = (e: ChangeEvent<HTMLSelectElement>) => {
        setTextGenerationModel(e.target.value);
    }

    const handleTemperatureChange = (e: ChangeEvent<HTMLInputElement>) => {
        setTemperature(parseFloat(e.target.value));
    }

    const handlePromptChange = (e: ChangeEvent<HTMLInputElement>) => {
        setPrompt(e.target.value);
    }

    const handleContextChange = (e: ChangeEvent<HTMLInputElement>) => {
        setContext(e.target.value);
    }

    if (!isOpen) {
        return null;
    }

    const handleSaveAgent = async () => {
        const updatedData = data;
        updatedData.slug = id;
        updatedData.properties.context = context;
        updatedData.properties.prompt = prompt;
        updatedData.properties.temperature = temperature;
        updatedData.properties.generation_model = textGenerationModel;
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

                <div className="relative overflow-x-auto overflow-y-auto">
                    <div className="mt-2">
                        <div className="flex space-x-2 items-center">
                            <p className="">Text Generation Model</p>
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
                            value={textGenerationModel}
                            onChange={handleTextGenerationModelChange}
                        >
                            {textGenerationModels.map((model) => (
                                <option value={model.value}>{model.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="mt-4">
                        <div className="flex space-x-2 items-center">
                            <p className="">Temperature</p>
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
                        <div>
                            <input type="text" value={temperature} onChange={handleTemperatureChange}/>
                        </div>
                    </div>
                    <div className="mt-4">
                        <div className="flex space-x-2 items-center">
                            <p className="">Prompt</p>
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
                        <div>
                            <input type="text" value={prompt} onChange={handlePromptChange}/>
                        </div>
                    </div>
                    <div className="mt-4">
                        <div className="flex space-x-2 items-center">
                            <p className="">Context</p>
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
                        <div>
                            <input type="text" value={context} onChange={handleContextChange}/>
                        </div>
                    </div>
                    <div className="flex justify-end mt-4">
                        <button className="bg-emerald-100 rounded-lg p-2" onClick={handleSaveAgent}>Save</button>
                    </div>
                </div>
            </div>
        </div>
        ,
        document.body
    )
}

export default ChatModal;