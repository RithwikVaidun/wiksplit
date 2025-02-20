import {
  Grid,
  Box,
  Card,
  CardContent,
  Typography,
  CardActionArea,
  IconButton,
  Button,
  TextField,
  Paper,
  InputLabel,
  FormControl,
  Menu,
  MenuItem,
  Select,
} from "@mui/material";

import {
  GridActionsCellItem,
  DataGrid,
  GridColumnMenu,
} from "@mui/x-data-grid";
import { List, ListItem, ListItemText, Divider } from "@mui/material";
import SplitGrid from "../components/splitGrid";
import EditGrid from "../components/editGrid";
import MyBar from "../components/appBar";
import PhotoUpload from "../components/photoUpload";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import apiClient from "../context/axios";
import axios from "axios";

export default function Home() {
  const receiptCache = useRef({});
  const [fetchedRows, setFetchedRows] = useState([]);
  const [fetchedColumns, setFetchedColumns] = useState([]);
  const [receiptIDS, setReceiptIDS] = useState([]);
  const [recID, setRecID] = useState();
  const { user, login, logout, loading } = useAuth();
  const [toggle, setToggle] = useState(false);

  const honorRow = [
    { item: "HBO W/ALMNDS", price: 7.99 },
    { item: "CHOC CREPES", price: 7.99 },
    { item: "KS SCENT BAG", price: 17.99 },
    { item: "BUTTERMILK", price: 7.29 },
  ];

  const initRow = [
    { item: "Milk", price: 10 },
    { item: "Eggs", price: 3 },
    // { item: "Bread", price: 8 },
  ];

  async function test() {
    // const userID = user.id;
    try {
      // const res = await apiClient.get("/users", {
      //   params: { receipt_id: 6 },
      // });
      if (toggle) {
        setFetchedRows(honorRow);
        setToggle(false);
      } else {
        setFetchedRows(initRow);
        setToggle(true);
      }

      // const res = await apiClient.post("/getDB");
      // const res = await apiClient.get("/users");
      // console.log(res.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }

  const reset = async () => {
    const res = await axios
      .post("http://127.0.0.1:8000/resetDB")
      .then((response) => {
        return response.data;
      })
      .catch((error) => console.error(error));
  };

  async function getAllRecs(userID) {
    try {
      const response = await apiClient.get("/userReceipts", {
        params: { user_id: userID },
      });

      setReceiptIDS(response.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }

  useEffect(() => {
    if (!user) return;
    getAllRecs(user.id);
  }, [recID, user]);

  const getReceiptData = async (receiptId) => {
    if (receiptCache.current[receiptId]) {
      return receiptCache.current[receiptId];
    }
    try {
      const res = await apiClient.get("/receipts", {
        params: { receipt_id: receiptId },
      });
      receiptCache.current[receiptId] = res.data;
      return res.data;
    } catch (error) {
      console.error("Error fetching receipt data:", error);
      return { rows: [], columns: [] };
    }
  };

  const [num, setNum] = useState();

  const cardClick = (id, index) => {
    setRecID(id);
    setNum(index + 1);
  };

  const honorCol = [
    { username: "david" },
    { username: "joe" },
    { username: "bob" },
  ];

  const initCol = [{ username: "Joe" }, { username: "Bob" }];

  const debug = false;
  // const debug = true;

  if (!debug) {
    return (
      <>
        <MyBar />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "fit-content",
            margin: "20px auto",
            gap: "1rem",
          }}
        >
          <PhotoUpload setRs={setFetchedRows} />
          <div style={{}}>
            {fetchedRows.length >= 1 ? (
              <SplitGrid
                setRID={setRecID}
                initialRows={fetchedRows}
                initialColumns={initCol}
              />
            ) : (
              <SplitGrid
                setRID={setRecID}
                initialRows={initRow}
                initialColumns={initCol}
              />
            )}
          </div>

          {user && (
            <div>
              <h1>My Reciepts</h1>

              <Box sx={{ width: "100%", overflowX: "auto" }}>
                <Box sx={{ display: "flex", gap: 2, pb: 2 }}>
                  {receiptIDS.map((receipt, index) => (
                    <Card
                      key={receipt.id}
                      variant="outlined"
                      onClick={() => cardClick(receipt.id, index)}
                      sx={{
                        minWidth: 250,
                        flex: "0 0 auto",
                        cursor: "pointer",
                        "&:hover": { backgroundColor: "#f5f5f5" },
                      }}
                    >
                      <CardActionArea>
                        <CardContent>
                          <Typography variant="h6">
                            Receipt {index + 1}
                          </Typography>
                          <Typography variant="body2">
                            {receipt.receipt_date} - {receipt.names.join(", ")}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  ))}
                </Box>
              </Box>

              {num && <h2> Receipt {num} </h2>}

              {recID && (
                <EditGrid receiptId={recID} getReceiptData={getReceiptData} />
              )}
            </div>
          )}
          {/* <Button variant="contained" color="secondary" onClick={test}> */}
          {/*   test */}
          {/* </Button> */}
        </div>
      </>
    );
  } else {
    return (
      <>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "fit-content",
            margin: "0 auto",
            gap: "1rem",
          }}
        >
          <SplitGrid initialRows={honorRow} initialColumns={honorCol} />
        </div>
      </>
    );
  }
}
