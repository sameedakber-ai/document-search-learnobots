import { Link } from "react-router-dom";
import Form from "../components/Form";

function Register() {
    return (
        <div className="h-screen justify-center items-center flex">
            <div className="p-8 rounded-xl">
                <Form route="/api/user/register/" method="register" />
                <div className="mt-4 text-center">
                    <span>Already have an account? </span>
                    <Link to="/login" className="text-blue-500 hover:underline">
                        Login here
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default Register;