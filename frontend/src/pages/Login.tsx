import { Link } from "react-router-dom";
import Form from "../components/Form.tsx";

function Login() {
    return (
        <div className="h-screen justify-center items-center flex">
            <div className="p-8 rounded-xl">
                <Form route="/api/token/" method="login" />
                {/* Registration Link */}
                <div className="mt-4 text-center">
                    <span>Don't have an account? </span>
                    <Link to="/register" className="text-blue-500 hover:underline">
                        Register here
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Login;