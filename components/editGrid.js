import { useState, useEffect, useRef } from "react";
import { DataGrid } from "@mui/x-data-grid";
import { useRouter } from "next/router";
import apiClient from "../context/axios";
import {
  InputLabel,
  Select,
  MenuItem,
  FormControl,
  IconButton,
  Button,
  TextField,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  Copy,
  Snackbar,
} from "@mui/material";

import DeleteIcon from "@mui/icons-material/Delete";
import styles from "../styles/Home.module.css"; // Import the CSS file
import { X, Share2 } from "lucide-react";
import clsx from "clsx";

const EditGrid = ({ receiptId, getReceiptData }) => {
  const renderPersonCell = (params) => {
    const isOptedIn = !!params.value; // Check if value exists
    return <div>{isOptedIn ? `$${Number(params.value).toFixed(2)}` : ""}</div>;
  };

  async function test() {
    for (let i = 0; i < rows.length; i++) {
      // console.log(rows[i].id, rows[i].item, rows[i].price);
      console.log(rows[i]);
    }

    for (let i = 0; i < columns.length - 1; i++) {
      // console.log(columns[i].field, columns[i].headerName);
      // console.log(columns[i]); //whate
    }
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

  const getNew = (id, field) => {
    // 🔄 Compute the new state first
    const ans = (() => {
      // Exclude the totals row from processing
      let dataRows = rows.filter((row) => row.id !== "totals");

      // Update the target row
      const updatedRows = dataRows.map((row) => {
        if (row.id === id) {
          const updatedRow = {
            ...row,
            [field]: !row[field], // Toggle cell value
          };

          // 🧠 Calculate participant count
          const participants = columns.filter(
            (col) =>
              !["item", "price", "actions"].includes(col.field) &&
              (col.field === field ? !row[field] : !!row[col.field]),
          ).length;

          // 💡 Calculate split amount
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

      // 📊 Recalculate Totals Row
      const totals = {};
      columns.forEach((col) => {
        if (!["item", "actions"].includes(col.field)) {
          totals[col.field] = updatedRows.reduce((sum, row) => {
            return sum + (parseFloat(row[col.field]) || 0);
          }, 0);
        }
      });

      const totalsRow = {
        id: "totals",
        item: "TOTAL",
        ...totals,
      };

      return [...updatedRows, totalsRow]; // ✅ Return the computed state
    })();

    return ans;
  };

  const updateReceipt = (id, field) => {
    setRows((prevRows) => {
      const ans = (() => {
        let dataRows = prevRows.filter((row) => row.id !== "totals");

        const updatedRows = dataRows.map((row) => {
          if (row.id === id) {
            const updatedRow = {
              ...row,
              [field]: !row[field],
            };

            const participants = columns.filter(
              (col) =>
                !["item", "price", "actions"].includes(col.field) &&
                (col.field === field ? !row[field] : !!row[col.field]),
            ).length;

            const splitAmount =
              participants > 0 ? (row.price / participants).toFixed(2) : 0;

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

        const totals = {};
        columns.forEach((col) => {
          if (!["item", "actions"].includes(col.field)) {
            totals[col.field] = updatedRows.reduce((sum, row) => {
              return sum + (parseFloat(row[col.field]) || 0);
            }, 0);
          }
        });

        const totalsRow = {
          id: "totals",
          item: "TOTAL",
          ...totals,
        };

        return [...updatedRows, totalsRow];
      })();

      return ans;
    });
  };

  useEffect(() => {
    const wsURL = url.replace("http", "ws");
    const ws = new WebSocket(`${wsURL}/ws/${receiptId}`);
    websocketRef.current = ws;
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "cell_update") {
        updateReceipt(data.item_id, data.user_id);
      }
    };
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    };
  }, [receiptId, columns]);

  useEffect(() => {
    async function fetchData() {
      const { rows: fetchedRows, columns: fetchedColumns } =
        await getReceiptData(receiptId);

      const totals = calculateTotals(fetchedRows, fetchedColumns);
      const totalsRow = {
        id: "totals",
        item: "TOTAL",
        price: null,
        ...totals,
      };
      setRows([...fetchedRows, totalsRow]);

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
          // renderCell: renderPersonCell,
          editable: false,
          valueFormatter: (value) => {
            if (value === null || value === undefined || isNaN(value)) {
              return ""; // Return blank if the value is invalid
            }
            return `$${Number(value).toFixed(2)}`; // Format the value if valid
          },
          width: 70,
        },
      ];

      const dynamicColumns = fetchedColumns.map(({ id, username }) => ({
        field: String(id), // Ensure it's a string for DataGrid compatibility
        headerName: username,
        width: 105,
        renderCell: renderPersonCell,
        cellClassName: (params) =>
          clsx(styles.splitCell, {
            [styles.selectedCell]: !!params.value,
          }),
      }));

      setColumns([...staticColumns, ...dynamicColumns]);
    }

    fetchData(); // Call the inner async function
  }, [receiptId, getReceiptData]);

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }

    setOpen(false);
  };

  const deleteReceipt = async () => {
    try {
      // const response = await axios.post(`${url}/deleteRec`, {
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
        receipt_id: receiptId, // Ensure receiptId is an integer
      });

      if (response.status !== 200) {
        throw new Error("Failed to generate link");
      }

      const { encrypted_url } = response.data;

      // Create the shareable URL with the encrypted data from backend
      const shareableUrl = `${window.location.origin}/receipt/shared/${encodeURIComponent(encrypted_url)}`;

      // Update state
      setShareableLink(shareableUrl);
      setShareDialogOpen(true);
    } catch (error) {
      console.error("Error generating share link:", error);
      // Optionally show an error message to user
      // setError('Failed to generate sharing link');
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

  const calculateTotals = (rows = [], columns = []) => {
    // Initialize totals for each user ID and overall price
    const initialTotals = { price: 0 };
    columns.forEach((col) => {
      initialTotals[col.id] = 0; // Initialize user ID totals
    });

    // Calculate totals correctly
    const totals = rows.reduce((acc, row) => {
      // Skip rows without price
      if (!row.price) return acc;

      // Add only the item price to the total price ONCE
      acc.price += parseFloat(row.price);

      // Add split amounts to each user's total
      Object.keys(row).forEach((key) => {
        if (acc.hasOwnProperty(key) && key !== "price") {
          acc[key] += parseFloat(row[key]) || 0;
        }
      });

      return acc;
    }, initialTotals);

    return {
      id: "totals",
      item: "TOTAL",
      ...totals,
    };
  };

  const handleCellClick = (params) => {
    const { id, field } = params;
    if (
      id === -1 ||
      id === "totals" ||
      ["item", "price", "placeholder", "actions"].includes(field)
    ) {
      return;
    }
    let newRows = getNew(id, field);

    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      const updateMessage = {
        type: "cell_update",
        item_id: id,
        user_id: field,
        row: newRows.find((row) => row.id === id),
      };
      websocketRef.current.send(JSON.stringify(updateMessage));
    } else {
      console.error("WebSocket is not open");
    }
  };

  useEffect(() => {}, [rows]);

  const processRowUpdate = (newRow, oldRow) => {
    return new Promise((resolve) => {
      setRows((prevRows) => {
        const isPlaceholderRow = newRow.id === -1;

        // Handle placeholder row logic
        if (isPlaceholderRow && newRow.item.trim() !== "") {
          const newId = prevRows.length;
          const updatedRows = [
            ...prevRows.filter((row) => row.id !== -1),
            { ...newRow, id: newId },
            {
              id: -1,
              item: "",
              price: null,
            },
          ];
          resolve({ ...newRow, id: newId });
          return updatedRows;
        }

        // Handle regular row update
        const updatedRows = prevRows.map((row) => {
          if (row.id === newRow.id) {
            // Detect price change and recalculate splits
            if (newRow.price !== oldRow.price) {
              const participants = columns.filter(
                (col) =>
                  !["item", "price"].includes(col.field) && !!newRow[col.field],
              ).length;

              const splitAmount =
                participants > 0 ? (newRow.price / participants).toFixed(2) : 0;

              // Update participating columns with the new split price
              columns.forEach((col) => {
                if (
                  !["item", "price"].includes(col.field) &&
                  !!newRow[col.field]
                ) {
                  newRow[col.field] = parseFloat(splitAmount);
                }
              });
            }

            return newRow;
          }
          return row;
        });

        resolve(newRow);
        return updatedRows;
      });
    });
  };

  const handleColumnResize = (col) => {
    if (col.colDef.field === "item") {
      setFirstColumnWidth(col.width);
      // setColor("red");
    }
  };

  const saveReceipt = async () => {
    try {
      const response = await axios.post(`${url}/save-receipt`, {
        receipt_id: receiptId,
        rows,
      });
    } catch (error) {
      console.error("Error saving receipt data:", error);
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
          onCellClick={(params) => handleCellClick(params)} // Add this event handler
          processRowUpdate={processRowUpdate}
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
