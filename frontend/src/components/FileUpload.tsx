import React, {useState} from "react";
import {X} from "lucide-react";
import api from "../api.ts";
import {ACCESS_TOKEN, REFRESH_TOKEN} from "../constants";

const FileUpload = () => {
    const [files, setFiles] = useState([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);

    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files);
        setFiles((prev) => [...prev, ...selectedFiles]);
    };

    const uploadFiles = async () => {
        if (files.length === 0) return;

        setIsUploading(true);
        let totalProgress = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const formData = new FormData();
            formData.append('file', file);

            // Simulating file upload progress
            await new Promise((resolve) => {
                const interval = setInterval(() => {
                    totalProgress += 100 / (files.length * 10); // Simulate 10 steps per file
                    setUploadProgress(Math.min(totalProgress, 100));
                    if (totalProgress >= ((i + 1) / files.length) * 100) {
                        clearInterval(interval);
                        resolve();
                    }
                }, 100);
            });
            try {
                const res = await api.post('/api/upload/', formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }); // Use await for the API call

            } catch (error: any) {
                alert(error.message || "An error occurred"); // Handle errors
            }
        }

        setIsUploading(false);
        setUploadProgress(0);
        setFiles([]);
    };

    const cancelUpload = () => {
        setIsUploading(false);
        setUploadProgress(0);
        setFiles([]);
    };

    const removeFile = (index) => {
        const updatedFiles = files.filter((_, i) => i !== index);
        setFiles(updatedFiles);
    };

    return (
        <div className="max-w-lg mt-4 p-4 bg-red-100 rounded-2xl shadow-md border-1 border-red-500">
            <h1 className="text-2xl font-semibold mb-4">File Upload</h1>
            <div>
                <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border file:border-gray-300 file:text-sm file:font-semibold file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
                />

                {files.length > 0 && (
                    <div className="mb-4">
                        <ul className="space-y-2 max-h-[calc(120px)] overflow-y-scroll">
                            {files.map((file, index) => (
                                <li
                                    key={index}
                                    className="flex items-center justify-between bg-gray-100 p-2 rounded-lg shadow-sm"
                                >
                                    <span className="text-sm text-gray-700 truncate w-4/5">{file.name}</span>
                                    <button
                                        onClick={() => removeFile(index)}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        <X size={16}/>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {isUploading && (
                    <div className="relative w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-blue-500 transition-all"
                            style={{width: `${uploadProgress}%`}}
                        ></div>
                    </div>
                )}

                <div className="mt-4 flex space-x-2">
                    <button
                        onClick={uploadFiles}
                        disabled={isUploading || files.length === 0}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 disabled:opacity-50"
                    >
                        {isUploading ? "Uploading..." : "Upload"}
                    </button>
                    {isUploading && (
                        <button
                            onClick={cancelUpload}
                            className="px-4 py-2 bg-red-500 text-white rounded-lg shadow hover:bg-red-600"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FileUpload;