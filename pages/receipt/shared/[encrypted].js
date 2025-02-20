import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";

import EditGrid from "../../../components/editGrid";
import { CircularProgress, Paper } from "@mui/material";

import apiClient from "../../../context/axios";
export default function SharedReceipt() {
  const router = useRouter();
  const { encrypted } = router.query;
  const [receiptId, setReceiptId] = useState(null);
  const [error, setError] = useState(null);
  const url = process.env.NEXT_PUBLIC_API_BASE;

  const getReceiptData = async (receiptId) => {
    try {
      const res = await apiClient.get("/loopa", {
        params: { receipt_id: receiptId },
      });
      return res.data;
    } catch (error) {
      console.error("Error fetching receipt data:", error);
      return { rows: [], columns: [] };
    }
  };

  useEffect(() => {
    if (!encrypted) return;

    const verifyLink = async () => {
      try {
        const response = await apiClient.post("/verify-share-link", {
          encrypted_data: encrypted,
        });

        if (response.status === 200 && response.data.success) {
          setReceiptId(response.data.receipt_id);
        } else {
          throw new Error("Invalid or expired link");
        }
      } catch (error) {
        console.error("Failed to verify link:", error);
        setError("Invalid or expired link");
      }
    };

    verifyLink();
  }, [encrypted]);

  if (error) {
    return (
      <Paper style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Error</h2>
        <p>{error}</p>
      </Paper>
    );
  }

  if (!receiptId) {
    return (
      <div
        style={{ display: "flex", justifyContent: "center", padding: "2rem" }}
      >
        <CircularProgress />
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex", // Use flex layout
        justifyContent: "center", // Center horizontally
        marginTop: "2rem", // Add space from the top
      }}
    >
      <EditGrid receiptId={receiptId} getReceiptData={getReceiptData} />
    </div>
  );
}
