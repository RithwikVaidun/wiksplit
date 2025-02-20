import React from "react";
import { AuthProvider } from "../context/AuthContext";

import "../styles/global.css";

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}

export default MyApp;
