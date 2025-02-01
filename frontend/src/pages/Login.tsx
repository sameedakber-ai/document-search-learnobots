import Form from "../components/Form.tsx";

function Login() {
    return <div className="h-screen justify-center items-center flex">
        <div className="p-8 rounded-xl">
            <Form route="/api/token/" method="login" />
        </div>
    </div>
}

export default Login;