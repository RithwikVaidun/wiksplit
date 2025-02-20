import React from "react";
import { useAuth } from "../context/AuthContext";
import { GoogleLogin, GoogleOAuthProvider } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import MenuIcon from "@mui/icons-material/Menu";
import { useRouter } from "next/router";

const MyBar = () => {
  const { user, login, logout, loading } = useAuth();
  const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const router = useRouter();

  const handleSignIn = async (credentialResponse) => {
    try {
      await login(credentialResponse.credential);
    } catch (error) {
      console.error("Google Sign-In Failed", error);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AppBar position="static" sx={{ width: "100%" }}>
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            wiksplit
          </Typography>
          {user ? (
            <>
              <Typography noWrap>Welcome, {user.name.split(" ")[0]}</Typography>
              <Button onClick={logout} color="inherit">
                Logout
              </Button>
            </>
          ) : (
            <GoogleLogin
              onSuccess={handleSignIn}
              onError={() => console.error("Login Failed")}
            />
          )}
        </Toolbar>
      </AppBar>
    </GoogleOAuthProvider>
  );
};

export default MyBar;
