import Form from "../components/Form"
function Register() {
    return <div className="h-screen justify-center items-center flex">
        <div className="p-8 rounded-xl">
            <Form route="/api/user/register/" method="register" />
        </div>
    </div>
}

export default Register;