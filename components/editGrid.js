//prettier-ignore
import { InputLabel, Select, MenuItem, FormControl, IconButton, Button, TextField, Paper, Dialog, DialogTitle, DialogContent, DialogContentText, Copy,Snackbar, } from "@mui/material";
import { useState, useEffect, useRef } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { useRouter } from "next/router";
import apiClient from "../context/axios";
import { useAuth } from "../context/AuthContext";

import DeleteIcon from "@mui/icons-material/Delete";
import styles from "../styles/Home.module.css";
import { X, Share2 } from "lucide-react";
import clsx from "clsx";

const clientId = Math.random().toString(36).substring(2);

const EditGrid = ({ receiptId, getReceiptData }) => {
  const { user } = useAuth();
  const renderPersonCell = (params) => {
    const isOptedIn = !!params.value;
    return <div>{isOptedIn ? `$${Number(params.value).toFixed(2)}` : ""}</div>;
  };

  async function test() {
    for (let i = 0; i < rows.length; i++) {
      console.log(rows[i]);
    }

    for (let i = 0; i < columns.length - 1; i++) {}
  }

  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [users, setUsers] = useState([]);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareableLink, setShareableLink] = useState("");
  const [open, setOpen] = useState(false);
  const [firstColumnWidth, setFirstColumnWidth] = useState(100);
  const websocketRef = useRef(null);
  const router = useRouter();
  const isSharedPage = router.pathname.includes("/receipt/shared/");
  const url = process.env.NEXT_PUBLIC_API_BASE;

  const [itemRows, setItemRows] = useState([]);
  const [totalsRow, setTotalsRow] = useState({
    item: "TOTAL",
    price: null,
    id: "totals",
  });
  const [userCols, setUserCols] = useState([]);

  useEffect(() => {
    const wsURL = url.replace("http", "ws");
    const ws = new WebSocket(`${wsURL}/ws/${receiptId}`);
    console.log("WebSocket connected");
    websocketRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "cell_update" && data.sender_id !== clientId) {
        getNew(data.item_id, data.user_id);
      }
    };

    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
        console.log("WebSocket disconnected");
      }
    };
  }, [receiptId, columns]);

  const handleCellClick = (params) => {
    const { id, field } = params;

    if (id === "totals" || ["item", "price"].includes(field)) {
      return;
    }

    let newRows = getNew(id, field);

    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      const updateMessage = {
        type: "cell_update",
        item_id: id,
        user_id: field,
        row: newRows.find((row) => row.id === id),
        sender_id: clientId,
      };

      websocketRef.current.send(JSON.stringify(updateMessage));
    } else {
      console.error("WebSocket is not open");
    }
  };

  const staticColumns = [
    {
      field: "item",
      headerName: "Item",
      width: firstColumnWidth,
      editable: false,
    },
    {
      field: "price",
      headerName: "Price",
      type: "number",
      valueFormatter: (value) => {
        if (value === null || value === undefined || isNaN(value)) {
          return "";
        }
        return `$${Number(value).toFixed(2)}`;
      },
      width: 70,
    },
  ];

  useEffect(() => {
    async function fetchData() {
      const { rows: fetchedRows, columns: fetchedColumns } =
        await getReceiptData(receiptId);

      // console.log(" fetched rows", fetchedRows);
      // console.log(" fetched columns", fetchedColumns);
      setItemRows(fetchedRows);

      const dynamicColumns = fetchedColumns.map(({ id, username }) => ({
        field: String(id), //for data grid
        headerName: username,
        width: 105,
        renderCell: renderPersonCell,
        cellClassName: (params) =>
          clsx(styles.splitCell, {
            [styles.selectedCell]: !!params.value,
          }),
      }));
      setUserCols(dynamicColumns);
      setColumns([...staticColumns, ...dynamicColumns]);
    }

    fetchData();
  }, [receiptId, getReceiptData]);

  useEffect(() => {
    setRows([...itemRows, totalsRow]);
  }, [itemRows, totalsRow]);

  useEffect(() => {
    setTotalsRow(calculateTotals(itemRows, userCols));
  }, [itemRows]);

  const processRowUpdate = (newRow, oldRow) => {
    return new Promise((resolve) => {
      let resRow = newRow;
      setItemRows((prevRows) => {
        const roundedPrice = parseFloat(newRow.price?.toFixed(2));
        newRow.price = roundedPrice;

        const updatedRows = prevRows.map((row) =>
          row.id === newRow.id ? newRow : row,
        );

        let newShare = recalculateShares(updatedRows, userCols);

        resRow = newShare.find((row) => row.id === newRow.id);
        // console.log("newShare", newShare);
        return newShare;
      });

      resolve(resRow);
    });
  };

  const recalculateShares = (currentRows, currentColumns) => {
    return currentRows.map((row) => {
      const updatedRow = { ...row };

      // Count participants for this row
      const participants = currentColumns.filter(
        (col) => !!row[col.field],
      ).length; // Only count fields that are true for this row

      // Calculate new split amount
      const splitAmount =
        participants > 0 ? (row.price / participants).toFixed(2) : 0;

      // Update amounts for all participating columns
      currentColumns.forEach((col) => {
        updatedRow[col.field] = !!row[col.field]
          ? parseFloat(splitAmount)
          : false;
      });

      return updatedRow;
    });
  };

  // const getNewa = (id, field, set) => {
  //   const ans = (() => {
  //     const curr = itemRowsRef.current;
  //
  //     console.log("set is", set, "item rows is", curr[0]);
  //     const updatedRows = curr.map((row) => {
  //       if (row.id === id) {
  //         const updatedRow = {
  //           ...row,
  //           [field]: !row[field], // Toggle cell value
  //         };
  //
  //         // 🧠 Calculate participant count
  //         const participants = columns.filter(
  //           (col) =>
  //             !["item", "price", "actions"].includes(col.field) &&
  //             (col.field === field ? !row[field] : !!row[col.field]),
  //         ).length;
  //
  //         // 💡 Calculate split amount
  //         const splitAmount = participants > 0 ? (row.price / participants).toFixed(2) : 0;
  //
  //         // Update all participant fields with the new split amount
  //         columns.forEach((col) => {
  //           if (!["item", "price", "actions"].includes(col.field)) {
  //             const isParticipating = col.field === field ? !row[field] : !!row[col.field];
  //             updatedRow[col.field] = isParticipating ? splitAmount : false;
  //           }
  //         });
  //
  //         return updatedRow;
  //       }
  //       return row;
  //     });
  //
  //     return updatedRows;
  //   })();
  //
  //   if (set) {
  //     setItemRows(ans);
  //   }
  //
  //   return ans;
  // };
  // GET NEW FUNCTION DOES NOT GET RECREATED, so old value of itemRows is used

  const getNew = (id, field) => {
    let ret = [];
    setItemRows((prevRows) => {
      const updatedRows = prevRows.map((row) => {
        if (row.id === id) {
          const updatedRow = {
            ...row,
            [field]: !row[field], // Toggle cell value
          };

          // Calculate participant count
          const participants = columns.filter(
            (col) =>
              !["item", "price", "actions"].includes(col.field) &&
              (col.field === field ? !row[field] : !!row[col.field]),
          ).length;

          // Calculate split amount
          const splitAmount =
            participants > 0 ? (row.price / participants).toFixed(2) : 0;

          // Update all participant fields with the new split amount
          columns.forEach((col) => {
            if (!["item", "price", "actions"].includes(col.field)) {
              const isParticipating =
                col.field === field ? !row[field] : !!row[col.field];
              updatedRow[col.field] = isParticipating ? splitAmount : false;
            }
          });

          return updatedRow;
        }
        return row;
      });

      ret = updatedRows;
      return updatedRows;
    });

    return ret;
  };

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setOpen(false);
  };

  const deleteReceipt = async () => {
    try {
      const response = await apiClient.post("/deleteRec", {
        recID: receiptId,
      });
    } catch (error) {
      console.error("Error deleting receipt:", error);
    }
    location.reload();
  };

  const generateShareableLink = async () => {
    try {
      const response = await apiClient.post("/generate-share-link", {
        receipt_id: receiptId,
      });

      if (response.status !== 200) {
        throw new Error("Failed to generate link");
      }

      const { encrypted_url } = response.data;

      const shareableUrl = `${window.location.origin}/receipt/shared/${encodeURIComponent(encrypted_url)}`;

      setShareableLink(shareableUrl);
      setShareDialogOpen(true);
    } catch (error) {
      console.error("Error generating share link:", error);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareableLink);
      setShareDialogOpen(false);
      setOpen(true);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const calculateTotals = (rows, columns) => {
    const initialTotals = columns.reduce(
      (totals, col) => {
        totals[col.field] = 0;
        return totals;
      },
      { price: 0 },
    );

    // reduce rows to calculate totals
    const totals = rows.reduce((acc, row) => {
      // Add price to the total
      if (row.price) {
        acc.price += parseFloat(row.price) || 0;
      }

      // Add person totals
      columns.forEach((col) => {
        if (row[col.field]) {
          acc[col.field] += parseFloat(row[col.field]) || 0;
        }
      });

      return acc;
    }, initialTotals);

    // console.log("calcTotals returns", totals);
    return { ...totals, id: "totals", item: "TOTAL" };
  };

  const handleColumnResize = (col) => {
    if (col.colDef.field === "item") {
      setFirstColumnWidth(col.width);
    }
  };

  return (
    <div>
      <div
        style={{
          display: "block",
          width: "fit-content",
          height: "fit-content",
        }}
      >
        <DataGrid
          rows={rows}
          columns={columns}
          onCellClick={(params) => handleCellClick(params)}
          processRowUpdate={processRowUpdate}
          rowHeight={40}
          disableColumnSorting
          disableColumnMenu
          autoHeight
          disableRowSelectionOnClick
          showCellVerticalBorder
          hideFooter
          onProcessRowUpdateError={(error) => console.log("Error:", error)}
          onColumnWidthChange={handleColumnResize}
          disableVirtualization
          getRowClassName={(params) => {
            if (params.id === "totals") {
              return "totalsRow";
            }
            return "";
          }}
          sx={{
            "& .MuiDataGrid-columnHeader[data-field='item']": {
              position: "sticky",
              left: 0,
              backgroundColor: "#fff",
              zIndex: 3,
            },
            "& .MuiDataGrid-cell[data-field='item']": {
              position: "sticky",
              left: 0,
              backgroundColor: "#fff",
              zIndex: 2,
            },

            "& .MuiDataGrid-columnHeader[data-field='price']": {
              position: "sticky",
              left: firstColumnWidth,
              backgroundColor: "#fff",
              zIndex: 2,
            },
            "& .MuiDataGrid-cell[data-field='price']": {
              position: "sticky",
              left: firstColumnWidth,
              backgroundColor: "#fff",
              zIndex: 2,
            },

            "& .totalsRow": {
              // backgroundColor: "#919090",
              fontWeight: "bold",
            },

            "& .MuiDataGrid-row:hover": {
              backgroundColor: "inherit",
            },
            "& .MuiDataGrid-row.Mui-hovered": {
              backgroundColor: "inherit",
            },

            "& .MuiDataGrid-main": {
              overflow: "auto",
            },
            "& .MuiDataGrid-virtualScroller": {
              overflow: "auto !important",
            },
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "#fff",
            },
          }}
        />
      </div>
      <Dialog
        open={shareDialogOpen}
        onClose={() => setShareDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Share Receipt
          <IconButton
            onClick={() => setShareDialogOpen(false)}
            style={{ position: "absolute", right: 8, top: 8 }}
          >
            <X />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Share this link with others to let them view and edit receipt:
          </DialogContentText>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <TextField
              fullWidth
              value={shareableLink}
              InputProps={{
                readOnly: true,
              }}
            />
            <Button variant="contained" onClick={copyToClipboard}>
              Copy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Snackbar
        open={open}
        autoHideDuration={2000}
        onClose={handleClose}
        message="Copied to clipboard"
      />
      {!isSharedPage && (
        <>
          <Button
            variant="outlined"
            startIcon={<Share2 />}
            onClick={generateShareableLink}
          >
            Share
          </Button>

          <Button
            variant="outlined"
            color="red"
            startIcon={<DeleteIcon />}
            onClick={deleteReceipt}
            style={{ marginLeft: 8, color: "red" }}
          >
            Delete
          </Button>
        </>
      )}

      {/* <Button variant="contained" color="secondary" onClick={test}> */}
      {/*   view grid */}
      {/* </Button> */}
      {/* </Paper> */}
    </div>
  );
};

export default EditGrid;
