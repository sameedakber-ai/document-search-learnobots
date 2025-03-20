import {ChangeEvent, FormEvent, useCallback, useEffect, useState} from "react";
import api from "../api";

export interface WorkflowData {
    id: string;
    name: string;
}

export interface WorkflowResponse {
    id: string;
    name: string;
    data: string;
    owner: number;
}

function Home() {
    const [workflows, setWorkflows] = useState<WorkflowData[]>([]);
    const [workflowName, setWorkflowName] = useState<string>('');

    const getWorkflows = useCallback(async (): Promise<void> => {
        try {
            const res = await api.get('/api/workflows/');
            const workflows: WorkflowData[] = res.data.map((workflowData: WorkflowResponse) => ({
                id: workflowData.id,
                name: workflowData.name
            }));
            setWorkflows(workflows);
        } catch(error) {
            alert(error);
        }

    }, []);

    useEffect(() => {
        const fetchData = async () => {
            await getWorkflows();
        }
        fetchData().then(r => {
            console.log(r)
        });
    }, [getWorkflows]);

    const handleCreateWorkflow = useCallback(async (e: FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();
        const res = await api.post('/api/workflow/create/', {'name': workflowName});
        setWorkflows((prevWorkflows) => [...prevWorkflows, res.data]);
    }, [workflowName]);

    const handleChangeName = (e: ChangeEvent<HTMLInputElement>) => {
        setWorkflowName(e.target.value);
    }

    return (
  <div id="home-id" className="h-screen flex flex-col">
    {/* Header */}

    {/* Main content area */}
    <div className="flex-1 bg-gray-50 flex flex-col">
      <div className="p-8">
        {workflows.map((workflow) => (
          <a key={workflow.id} href={`/workflows/${workflow.id}`}>
            <h2 className="text-2xl">
              {workflow.name}
            </h2>
          </a>
        ))}
      </div>
      <div className="flex items-center justify-center flex-grow">
        <form onSubmit={handleCreateWorkflow}>
          <input
            type="text"
            onChange={handleChangeName}
            value={workflowName}
            placeholder="New Workflow"
            className="border-2 p-2 rounded-lg"
          />
        </form>
      </div>
    </div>
  </div>
);

}

export default Home;