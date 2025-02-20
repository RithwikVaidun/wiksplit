import React, { createContext, useContext, useEffect, useState } from "react";
import Cookies from "js-cookie";
import apiClient from "./axios";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const url = process.env.NEXT_PUBLIC_API_BASE;

  useEffect(() => {
    const verifyUser = async () => {
      try {
        const response = await apiClient.get("/auth/verify");
        setUser(response.data.user);
      } catch (error) {
        console.error(error.response);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    // setLoading(false);
    verifyUser();
  }, [url]);

  const login = async (credential) => {
    try {
      const response = await apiClient.post("/auth/google", {
        credential,
      });
      Cookies.set("authToken", response.data.token, { expires: 7 });
      apiClient.defaults.headers.Authorization = `Bearer ${response.data.token}`;
      apiClient.defaults.headers.ngrok = `Bearer ${response.data.token}`;
      setUser(response.data.user);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = () => {
    setUser(null);
    Cookies.remove("authToken");
    location.reload();
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
