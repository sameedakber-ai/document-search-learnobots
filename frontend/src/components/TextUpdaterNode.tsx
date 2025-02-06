import {useCallback, useState} from 'react';
import {Handle, Position} from '@xyflow/react';
import Modal from "./Modal.tsx";
import api from "../api.ts";
import {node} from "globals";

const handleStyle = {left: 10};

const openModal = (e) => {

}

function TextUpdaterNode({data, id}) {
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
            <div className="flex justify between border-2 border-gray-500 rounded-md relative">
                <input placeholder="Node Name" onChange={onChange} value={nodeName}
                       className="text-center bg-transparent focus:outline-none p-2"/>
                <button className="absolute right-0 top-0" onClick={handleOpenModal}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                        <path fill-rule="evenodd"
                              d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v2.5h-2.5a.75.75 0 0 0 0 1.5h2.5v2.5a.75.75 0 0 0 1.5 0v-2.5h2.5a.75.75 0 0 0 0-1.5h-2.5v-2.5Z"
                              clip-rule="evenodd"/>
                    </svg>
                </button>
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

export default TextUpdaterNode;