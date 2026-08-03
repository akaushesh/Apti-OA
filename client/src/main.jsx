import './index.css';
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { store } from "./app/store";
import { Provider } from "react-redux";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { Protected, Secured } from './components/AuthLayout';

import Home from './pages/Home';
import BulkUpload from './pages/BulkUpload';
import TestConfig from './pages/TestConfig';
import AttemptScreen from './pages/AttemptScreen';
import ReviewScreen from './pages/ReviewScreen';
import EditSet from './pages/EditSet';
import AdminPanel from './pages/AdminPanel';

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />,
      },
      {
        path: "/upload",
        element: <Protected authentication><BulkUpload /></Protected>,
      },
      {
        path: "/test-config/:id",
        element: <Protected authentication><TestConfig /></Protected>,
      },
      {
        path: "/attempt/:id",
        element: <Protected authentication><AttemptScreen /></Protected>,
      },
      {
        path: "/review/:id",
        element: <Protected authentication><ReviewScreen /></Protected>,
      },
      {
        path: "/edit-set/:id",
        element: <Protected authentication><EditSet /></Protected>,
      },
      {
        path: "/admin",
        element: <Protected authentication><Secured requiredRole="admin"><AdminPanel /></Secured></Protected>,
      }
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </React.StrictMode>
);