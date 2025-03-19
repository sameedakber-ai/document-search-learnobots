import React, {useState} from 'react';
import api from "../api.ts";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (problems: string[]) => void;
    id: string;
}

const Modal: React.FC<ModalProps> = ({isOpen, onClose, onSubmit, id}) => {
    const [problems, setProblems] = useState<string[]>(['']); // Start with one input field
    const [description, setDescription] = useState<string>('');

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

    return (
        <div
            className="fixed inset-[calc(10%)] flex items-center justify-center z-50"
        >
            <div className="bg-gray-100 rounded-xl p-6 w-full shadow-lg h-[calc(60%)]">
                <form onSubmit={handleSubmit}>
                    <h2 className="text-lg font-semibold mb-4">Add description</h2>
                    <input
                        type="text"
                        value={description}
                        onChange={handleDescriptionChange}
                        placeholder="Node description"
                        className="w-full border border-gray-300 rounded-md p-2"
                    />
                    <h2 className="text-lg font-semibold mb-4 mt-8">Add Problems</h2>
                    {problems.map((problem, index) => (
                        <div key={index} className="mb-2">
                            <input
                                type="text"
                                value={problem}
                                onChange={(e) => handleProblemChange(index, e.target.value)}
                                placeholder={`Problem ${index + 1}`}
                                required
                                className="w-full border border-gray-300 rounded-md p-2"
                            />
                        </div>
                    ))}
                    {problems.length < 5 && (
                        <button
                            type="button"
                            onClick={addProblemField}
                            className="mt-2 text-green-500 hover:underline"
                        >
                            + Add Another Problem
                        </button>
                    )}
                    <div className="mt-4 flex justify-between">
                        <button
                            type="submit"
                            className="bg-green-500 text-white rounded-md px-4 py-2 hover:bg-green-600"
                        >
                            Submit
                        </button>
                        <button
                            type="button"
                            className="bg-red-500 text-white rounded-md px-4 py-2 hover:bg-red-600"
                            onClick={onClose}
                        >
                            Close
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Modal;
