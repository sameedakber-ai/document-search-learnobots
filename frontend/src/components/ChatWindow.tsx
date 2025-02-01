import React, {useState} from 'react';
import api from "../api.ts";

const ChatComponent = () => {
    const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
    const [input, setInput] = useState('');

    const handleSend = async () => {
        if (!input.trim()) return;

        // Add user message to the chat
        const userMessage = {sender: 'user', text: input};
        setMessages([...messages, userMessage]);

        const formData = new FormData();
        formData.append('input', input);

        const res = await api.post('/api/chat/', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        }); // Use await for the API call

        // Simulate AI response
        setTimeout(() => {
            const aiMessage = {sender: 'ai', text: res.data.output};
            setMessages((prevMessages) => [...prevMessages, aiMessage]);
        }, 1000);

        setInput('');
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleSend();
    };

    return (
        <div className="">
            {/* Chat Window */}
            <div className="flex-grow overflow-y-auto p-4">
                {messages.map((msg, index) => (
                    <div
                        key={index}
                        className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} mb-2`}
                    >
                        <div
                            className={`px-4 py-2 rounded-lg text-sm max-w-xs ${
                                msg.sender === 'user'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-200 text-gray-800'
                            }`}
                        >
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>

            {/* Input Box */}
            <div className="flex items-center p-4 bg-white">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Type your question..."
                    className="flex-grow border border-gray-300 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <button
                    onClick={handleSend}
                    className="ml-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                    Send
                </button>
            </div>
        </div>
    );
};

export default ChatComponent;
