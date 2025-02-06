import FileUpload from "../components/FileUpload";
import ChatComponent from "../components/ChatWindow";
import CustomLessonFlow from "../components/CustomLessonFlow";

function Home() {
    return (
        <div id="home-id">
            <div className="p-4 bg-gray-100 flex justify-between items-center">
                <a className="" href="/">
                    <h1 className="text-2xl font-bold">AI Workflow Automation</h1>
                </a>
                <div className="flex space-x-10">
                    <a className="text-lg" href="/profile">Profile</a>
                    <a className="text-lg" href="/logout">Logout</a>
                </div>
            </div>

            <div className="mt-6">
                {/*<FileUpload />*/}
                {/*<ChatComponent />*/}
                <CustomLessonFlow />
            </div>
        </div>
    )
}

export default Home;