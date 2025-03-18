import React, {useState, ChangeEvent} from "react";
import {createPortal} from "react-dom";
import {AgentData} from "../nodeTypes";

// ---------------------
// Form configuration types
// ---------------------

export interface FieldConfig {
    label?: string;
    inputType: "text" | "number" | "checkbox" | "select";
    options?: string[]; // For select inputs
}

export interface FormConfig {
    [propertyKey: string]: FieldConfig;
}

// ---------------------
// Default configuration lookup
// ---------------------

const getDefaultFormConfig = (nodeType: string): FormConfig | null => {
    switch (nodeType) {
        case "chat":
            return {
                generation_model: {label: "Generation Model", inputType: "text"},
                temperature: {label: "Temperature", inputType: "number"},
                // Add additional fields as needed...
            };
        case "chatTrigger":
            return {
                triggerMessage: {label: "Trigger Message", inputType: "text"},
                // Additional chatTrigger fields...
            };
        case "documentLoader":
            return {
                filePath: {label: "File Path", inputType: "text"},
                // Additional documentLoader fields...
            };
        case "memory":
            return {
                maxContextWindow: {label: "Max Context Window", inputType: "number"},
            };
        case "chatModel":
            return {
                generation_model: {label: "Generation Model", inputType: "text"},
                temperature: {label: "Temperature", inputType: "number"},
                maxRetries: {label: "Max Retries", inputType: "number"},
            };
        default:
            return null;
    }
};

// ---------------------
// BaseModal Props and Component
// ---------------------

interface BaseModalProps<T extends AgentData> {
    id: string;
    isOpen: boolean;
    onClose: () => void;
    data: T;
}

const BaseModal = <T extends AgentData>({
                                            id,
                                            isOpen,
                                            onClose,
                                            data,
                                        }: BaseModalProps<T>) => {
    // Initialize local form state with the node's properties.
    const [formData, setFormData] = useState<T["properties"]>(data.properties);

    // Generic change handler – can be expanded as needed.
    const handleChange = (
        key: string,
        inputType: FieldConfig["inputType"],
        event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        let value: any;
        if (inputType === "checkbox") {
            value = (event.target as HTMLInputElement).checked;
        } else if (inputType === "number") {
            value = Number(event.target.value);
        } else {
            value = event.target.value;
        }
        setFormData((prev) => ({...prev, [key]: value}));
    };

    if (!isOpen) return null;

    // Retrieve the appropriate form configuration based on the node type.
    const formConfig = getDefaultFormConfig(data.type);

    const renderForm = () => {
        if (!formConfig) {
            return (
                <div>
                    No configuration available for node type: <strong>{data.type}</strong>.
                </div>
            );
        }
        return (
            <form>
                {Object.keys(formConfig).map((fieldKey) => {
                    const config = formConfig[fieldKey];
                    const value = formData[fieldKey];
                    return (
                        <div key={fieldKey} className="mb-4">
                            <label className="block font-bold mb-1">
                                {config.label || fieldKey}
                            </label>
                            {config.inputType === "select" && config.options ? (
                                <select
                                    value={value}
                                    onChange={(e) => handleChange(fieldKey, config.inputType, e)}
                                    className="border p-1 w-full"
                                >
                                    {config.options.map((opt) => (
                                        <option key={opt} value={opt}>
                                            {opt}
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <input
                                    type={config.inputType}
                                    value={
                                        config.inputType === "checkbox" ? undefined : value
                                    }
                                    checked={
                                        config.inputType === "checkbox" ? !!value : undefined
                                    }
                                    onChange={(e) => handleChange(fieldKey, config.inputType, e)}
                                    className="border p-1 w-full"
                                />
                            )}
                        </div>
                    );
                })}
                <div className="mt-4 flex justify-end">
                    <button
                        type="button"
                        onClick={() => {
                            // Here you might propagate the changes back to the node data.
                            onClose();
                        }}
                        className="px-4 py-2 bg-blue-500 text-white rounded"
                    >
                        Save & Close
                    </button>
                </div>
            </form>
        );
    };

    // Decide layout based on the flowType field in the node data.
    // We assume data.flowType is one of "main", "trigger", or "sub".
    const renderLayout = () => {
        if (data.flowType === "main" || data.flowType === "sub") {
            // Three-column layout: Input (left), Form (center), Output (right)
            return (
                <div className="grid grid-cols-3 gap-4">
                    {/* Input Column */}
                    <div className="border p-4">
                        <h3 className="font-semibold mb-2">Input</h3>
                        {/* Replace the following placeholder with actual input info */}
                        <p>Incoming data settings...</p>
                    </div>
                    {/* Form Column */}
                    <div className="border p-4">{renderForm()}</div>
                    {/* Output Column */}
                    <div className="border p-4">
                        <h3 className="font-semibold mb-2">Output</h3>
                        {/* Replace the following placeholder with actual output info */}
                        <p>Outgoing data settings...</p>
                    </div>
                </div>
            );
        } else if (data.flowType === "trigger") {
            // Two-column layout: Form (left), Output (right)
            return (
                <div className="grid grid-cols-2 gap-4">
                    {/* Form Column */}
                    <div className="border p-4">{renderForm()}</div>
                    {/* Output Column */}
                    <div className="border p-4">
                        <h3 className="font-semibold mb-2">Output</h3>
                        {/* Replace the following placeholder with actual output info */}
                        <p>Outgoing data settings...</p>
                    </div>
                </div>
            );
        } else {
            // Default: just render the form
            return <div className="border p-4">{renderForm()}</div>;
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50">
            <div className="bg-white p-6 rounded shadow-lg max-w-4xl w-full">
                <h2 className="text-xl font-bold mb-4">Configure Node {id}</h2>
                {renderLayout()}
            </div>
        </div>,
        document.body
    );
};

export default BaseModal;
