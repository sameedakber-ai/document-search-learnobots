import FileUpload from "../components/FileUpload";
import ChatComponent from "../components/ChatWindow";

function Home() {
    return (
        <div>
            <div className="p-4 bg-gray-100 flex justify-between items-center">
                <a className="" href="/">
                    <h1 className="text-2xl font-bold">Home</h1>
                </a>
                <div className="flex space-x-10">
                    <a className="text-lg" href="/profile">Profile</a>
                    <a className="text-lg" href="/logout">Logout</a>
                </div>
            </div>

            <div>
                <FileUpload />
                <ChatComponent />
            </div>
        </div>
    )
}

export default Home;