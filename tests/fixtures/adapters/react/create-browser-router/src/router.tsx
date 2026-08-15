import { createBrowserRouter, RouterProvider } from "react-router-dom";

const router = createBrowserRouter([
  { path: "/", element: <div>Home</div> },
  { path: "/dashboard", element: <div>Dashboard</div> },
  {
    path: "/settings",
    children: [{ path: "profile", element: <div>Profile</div> }],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
