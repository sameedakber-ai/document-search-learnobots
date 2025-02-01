import {useState} from "react";
import api from "../api";
import {useNavigate} from "react-router-dom";
import {ACCESS_TOKEN, REFRESH_TOKEN} from "../constants";

interface FormProps {
    route: string;
    method: "login" | "register"; // Narrowing method type to "login" or "register"
}

function Form({route, method}: FormProps) {
    const [username, setUsername] = useState<string>("");
    const [password, setPassword] = useState<string>("");
    const [loading, setLoading] = useState<boolean>(false);
    const navigate = useNavigate();

    const name = method === "login" ? "Login" : "Register";

    // Mark handleSubmit as async to use await inside it
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault(); // Prevent form submission
        setLoading(true); // Start loading

        try {
            const res = await api.post(route, {username, password}); // Use await for the API call

            if (method === "login") {
                localStorage.setItem(ACCESS_TOKEN, res.data.access);
                localStorage.setItem(REFRESH_TOKEN, res.data.refresh);
                navigate("/"); // Redirect to home
            } else {
                navigate("/login"); // Redirect to login after registering
            }
        } catch (error: any) {
            alert(error.message || "An error occurred"); // Handle errors
        } finally {
            setLoading(false); // Stop loading
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <h1 className="text-3xl text-center font-bold">{name}</h1>
            <div className="space-y-4 mt-4">
                <input
                    className="block border-2 border-gray-200 rounded-full p-2"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                />
                <input
                    className="block border-2 border-gray-200 rounded-full p-2"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                />
                <div className="flex w-full justify-end">
                    <button className="bg-black text-white p-2 text-sm rounded-md" type="submit" disabled={loading}>
                        {loading ? "Loading..." : name}
                    </button>
                </div>
            </div>
        </form>
    );
}

export default Form;
