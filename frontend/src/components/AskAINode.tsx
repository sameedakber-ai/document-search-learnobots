import {ChangeEvent, FC, useCallback, useState} from 'react';
import {Handle, NodeProps, Position, XYPosition} from '@xyflow/react';

export interface NodeData {
    [key: string]: unknown;
    label: string;
    aiModel: string;
    temperature: number;
    context: string;
    prompt: string,
    onDelete?: (nodeId: string) => void;
    onChange?: (nodeId: string, changes: Partial<NodeData>) => void;
}

export interface DocumentUploaderData extends Record<string, unknown> {
    id: string,
    position: XYPosition,
    data: NodeData
}

export type DocumentUploaderNodeProps = NodeProps<DocumentUploaderData>;

const AskAINode: FC<DocumentUploaderNodeProps> = ({id, data}) => {

    const [aiModel, setAiModel] = useState<string>(data.aiModel);
    const [temperature, setTemperature] = useState<number>(data.temperature);
    const [prompt, setPrompt] = useState<string>(data.prompt);
    const [context, setContext] = useState<string>(data.context);

    // Delete node callback
    const handleDeleteClick = useCallback((): void => {
        if (data.onDelete) {
            data.onDelete(id);
        }
    }, [data, id]);

    // Change handlers – these update local state and call the parent's onChange callback.
    const onAiModelChange = useCallback((evt: ChangeEvent<HTMLSelectElement>): void => {
        const updated = evt.target.value;
        setAiModel(updated);
        if (data.onChange) {
            data.onChange(id, {aiModel: updated});
        }
    }, [data, id]);

    const onTemperatureChange = useCallback((evt: ChangeEvent<HTMLInputElement>): void => {
        const updated = parseFloat(evt.target.value) || 0;
        setTemperature(updated);
        if (data.onChange) {
            data.onChange(id, {temperature: updated});
        }
    }, [data, id]);

    const onPromptChange = useCallback((evt: ChangeEvent<HTMLInputElement>): void => {
        const updated = evt.target.value;
        setPrompt(updated);
        if (data.onChange) {
            data.onChange(id, {prompt: updated});
        }
    }, [data, id]);

    const onContextChange = useCallback((evt: ChangeEvent<HTMLTextAreaElement>): void => {
        const updated = evt.target.value;
        setContext(updated);
        if (data.onChange) {
            data.onChange(id, {context: updated});
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
                <div className="bg-pink-200 rounded-xl p-4">
                    <div className="flex space-x-4 items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                             stroke="currentColor" className="size-6">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"/>
                        </svg>
                        <h2 className="text-2xl">Ask AI</h2>
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
                    <input value={prompt} onChange={onPromptChange} type="text"
                           className="block border-1 border-gray-400 rounded-lg p-2 w-full mt-2"
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
                    <textarea value={context} onChange={onContextChange}
                              className="block border-1 border-gray-400 rounded-lg p-2 w-full mt-2"
                              placeholder="[Optional] This is additional context for the AI model that can be referenced in the prompt"/>
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
                        <p className="font-bold">Choose AI Model</p>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5"
                             stroke="currentColor" className="size-4">
                            <path stroke-linecap="round" stroke-linejoin="round"
                                  d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"/>
                        </svg>
                    </div>
                    <form className="max-w-sm mt-2 w-[calc(80%)]">
                        <select id="image-models" onChange={onAiModelChange} value={aiModel}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                            <option value="claude-3-haiku" selected>Claude 3 Haiku</option>
                            <option value="gpt-4o">GPT-4o</option>
                            <option value="gpt-4o-mini">GPT-4o mini</option>
                            <option value="openai-o1">OpenAI o1</option>
                        </select>
                    </form>
                </div>
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