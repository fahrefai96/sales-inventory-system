import { useEffect } from "react";
import { useAuth } from "../../context/authContext";
import { useNavigate } from "react-router-dom";

export default function Logout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    logout(); // clear user + token
    navigate("/login"); // go back to login
  }, [logout, navigate]);

  return null; // no UI needed
}
