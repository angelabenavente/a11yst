import { useRoutes } from "react-router-dom";

const PROJECTS = "/projects";

export function App() {
  const element = useRoutes([
    { path: "/", element: <div>Home</div> },
    { path: PROJECTS, element: <div>Projects</div> },
    { path: "/help", element: <div>Help</div> },
  ]);
  return element;
}
