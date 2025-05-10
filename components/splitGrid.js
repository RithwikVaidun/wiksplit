import { useRef, useState, useEffect, useMemo } from "react";
import { GridActionsCellItem, DataGrid, GridColumnMenu } from "@mui/x-data-grid";
import DeleteIcon from "@mui/icons-material/Delete";
import { IconButton, Button, TextField, Paper } from "@mui/material";
import { X, Shar2 } from "lucide-react";
import styles from "../styles/Home.module.css";
import clsx from "clsx";

import apiClient from "../context/axios";
import { useAuth } from "../context/AuthContext";

const SplitGrid = ({ initialRows, initialColumns, setRID }) => {
  const { user } = useAuth();

  const renderPersonCell = (params) => {
    const isOptedIn = !!params.value;
    return <div>{isOptedIn ? `$${Number(params.value).toFixed(2)}` : ""}</div>;
  };

  const [firstColumnWidth, setFirstColumnWidth] = useState(100);

  async function test() {
    for (let i = 0; i < rows.length; i++) {
      // console.log(rows[i]);
      console.log("id, item, price");
      console.log(rows[i].id, rows[i].item, rows[i].price);
    }

    for (let i = 0; i < columns.length - 1; i++) {
      // console.log(columns[i].field, columns[i].headerName);
      // console.log(columns[i]);
    }
    // console.log("rows", rows);
    // console.log("columns", columns);
  }

  const PlaceholderCol = ({ colDef }) => {
    const { field } = colDef;
    const [inputValue, setInputValue] = useState("");

    const handleChange = (e) => {
      setInputValue(e.target.value);
      return;
    };

    const handleHeaderChange = (e) => {
      if (field === "placeholder" && inputValue) {
        addColumn(inputValue); // Add the new column
        setInputValue("");
        // setErrorMessage("");
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault(); // Prevent form submission or default behavior
        handleHeaderChange(); // Call without event
      }
    };

    return (
      <input
        type="text"
        value={field === "placeholder" ? inputValue : colDef.headerName}
        onChange={handleChange}
        placeholder={field === "placeholder" ? "Add person..." : ""}
        onBlur={handleHeaderChange}
        onKeyDown={handleKeyDown}
        style={{ width: "100%", border: "none", outline: "none" }}
      />
    );
  };

  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  const createReceipt = async () => {
    const validRows = itemRows.map(({ id, ...rest }) => rest);
    const validColumns = userCols.map((field) => field.headerName);

    try {
      console.log("sending to backend", validRows, validColumns);
      const res = await apiClient.post("/createRec", {
        rows: validRows,
        columns: validColumns,
        creator_id: user.id,
      });

      setRID(res.data.id);
    } catch (error) {
      console.error("Error creating receipt:", error);
    }
  };

  const [userCols, setUserCols] = useState([]);
  const staticCols = [
    {
      field: "actions",
      type: "actions",
      headerName: "",
      width: 20,
      sortable: false,
      disableColumnMenu: true,
      getActions: (params) => {
        if (params.id === -1 || params.id === "totals") {
          return [];
        }

        return [
          <GridActionsCellItem
            icon={<DeleteIcon />}
            label="Delete"
            onClick={() => removeRow(params.id)}
            color="error"
          />,
        ];
      },
    },
    {
      field: "item",
      pinned: "left",
      width: firstColumnWidth,
      headerName: "Item",
      editable: true,
      renderCell: (params) => {
        if (params.id === -1) {
          return <TextField variant="standard" placeholder="add item"></TextField>;
        }
        return params.value;
      },
    },
    {
      field: "price",
      headerName: "Price",
      type: "number",
      width: 70,
      editable: true,
      valueFormatter: (value) => {
        if (value === null || value === undefined || isNaN(value)) {
          return ""; // Return blank if the value is invalid
        }
        return `$${Number(value).toFixed(2)}`; // Format the value if valid
      },
      renderCell: (params) => {
        if (params.id === -1)
          return <TextField variant="standard" placeholder="price" type="number"></TextField>;
      },
    },
  ];
  const placeholderColumn = {
    field: "placeholder",
    headerName: "",
    sortable: false,
    editable: false,
    disableClickEventBubbling: true,
    renderHeader: (params) => <PlaceholderCol {...params} />,
    renderCell: () => null,
  };

  // columns
  useEffect(() => {
    const dynamicColumns = initialColumns.map((user) => ({
      field: user.username, // Access the username property
      headerName: user.username, // Use the username as the header
      renderCell: renderPersonCell,
      width: 105,
      renderHeader: (params) => <CustomHeader {...params} />,
      cellClassName: (params) =>
        clsx(styles.splitCell, {
          [styles.selectedCell]: !!params.value,
        }),
    }));

    setUserCols(dynamicColumns);
  }, []);

  useEffect(() => {
    setColumns([...staticCols, ...userCols, placeholderColumn]); // Combine static and dynamic columns
  }, [userCols]);

  // rows

  const [itemRows, setItemRows] = useState([]);
  const placeholderRow = { id: -1, item: "", price: null };
  const [totalsRow, setTotalsRow] = useState({ item: "TOTAL", price: null, id: "totals" });

  useEffect(() => {
    const dataRows = initialRows.map((row, index) => ({
      ...row,
      id: index + 1, //for front end
    }));

    setItemRows(dataRows);

    const totalsRow = calculateTotals(dataRows, userCols);
    setTotalsRow(totalsRow);
    // setRows([...dataRows, placeholderRow, totalsRow]);
  }, [initialRows]);

  useEffect(() => {
    // test();
    setRows([...itemRows, placeholderRow, totalsRow]);
  }, [itemRows, totalsRow]);

  useEffect(() => {
    setTotalsRow(calculateTotals(itemRows, userCols));
  }, [itemRows, userCols]);

  const isButtonDisabled = useMemo(() => {
    if (!user) {
      setErrorMessage("Please login to create receipt");
      return true;
    }

    const len = itemRows.length;

    if (len === 0) {
      setErrorMessage("Add at least 1 item");
      return true;
    }

    for (let i = 0; i < len; i++) {
      const row = itemRows[i];
      if (!row.item || row.item.trim() === "") {
        setErrorMessage("Item name cannot be empty");
        return true;
      }
      if (row.price === null || row.price < 0.01 || isNaN(row.price)) {
        setErrorMessage(`${row.item} price is invalid`);
        return true;
      }
    }

    const dups = (array) => {
      const seen = new Set();
      for (const obj of array) {
        if (seen.has(obj.field)) {
          return obj.field;
        }
        seen.add(obj.field);
      }
      return null;
    };

    const duplicateField = dups(userCols);
    if (duplicateField) {
      setErrorMessage(`Name "${duplicateField}" is already used`);
      return true;
    }
    if (userCols.length < 2) {
      setErrorMessage("Add at least 2 users");
      return true;
    }

    for (let i = 0; i < userCols.length; i++) {
      const field = userCols[i].headerName;
      if (typeof field !== "string" || !field || field.trim() === "" || !/^[A-Za-z]+$/.test(field)) {
        setErrorMessage(`Columns ${field} empty or invalid`);
        return true;
      }
    }

    setErrorMessage("");
    return false;
  }, [rows, columns]);

  const handleDeleteColumn = (fieldToDelete) => {
    setUserCols((prevColumns) => {
      const newColumns = prevColumns.filter((col) => col.field !== fieldToDelete);

      // Update rows with recalculated values
      setItemRows((prevRows) => {
        const newRows = prevRows.map((row) => {
          const newRow = { ...row };
          delete newRow[fieldToDelete];
          return newRow;
        });

        // Recalculate shares for remaining columns
        return recalculateShares(newRows, newColumns);
      });
      return newColumns;
    });
  };

  const CustomHeader = (props) => {
    const { field, colDef, onUpdateHeaderName } = props;
    const [headerName, setHeaderName] = useState(colDef.headerName);

    const handleChange = (e) => {
      setHeaderName(e.target.value);
    };

    const handleBlur = () => {
      if (onUpdateHeaderName) {
        onUpdateHeaderName(field, headerName);
      }
    };
    if (true) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 8px",
            width: "100%",
          }}
        >
          {colDef.headerName}

          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteColumn(field);
            }}
          >
            <X size={16} />
          </IconButton>
        </div>
      );
    } else {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 8px",
            width: "100%",
          }}
        >
          {colDef.headerName}
        </div>
      );
    }

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 8px",
          width: "100%",
        }}
      >
        {/* Editable Input for Header Name */}

        {field !== "item" && field !== "price" && (
          <TextField
            value={headerName}
            onChange={handleChange}
            onBlur={handleBlur}
            variant="outlined"
            size="small"
            // style={{ flex: 1 }}
          />
        )}

        {/* Delete Icon (if applicable) */}
        {field !== "item" && field !== "price" && (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteColumn(field);
            }}
          >
            <X size={16} />
          </IconButton>
        )}
      </div>
    );
  };

  const addColumn = (newColumnName) => {
    const newField = newColumnName.replace(/\s/g, ""); // Remove spaces from the name

    let names = [];
    setUserCols((prevColumns) => {
      names = prevColumns.map((col) => col.field);
      return prevColumns;
    });
    if (names.includes(newField)) {
      console.log(errorMessage);
      setErrorMessage(`Name "${newColumnName}" is already used`);
      return;
    }

    setUserCols((prevColumns) => {
      const newCol = {
        field: newField,
        headerName: newColumnName,
        width: 105,
        renderCell: renderPersonCell,
        renderHeader: (params) => <CustomHeader {...params} />,
        cellClassName: (params) =>
          clsx(styles.splitCell, {
            [styles.selectedCell]: !!params.value,
          }),
      };
      return [...prevColumns, newCol];
    });

    setItemRows((prevRows) =>
      prevRows.map((row) => ({
        ...row,
        [newField]: false,
      })),
    );
    setErrorMessage("");
  };

  const removeRow = (id) => {
    setItemRows((prevRows) => prevRows.filter((row) => row.id !== id));
    processRowUpdate({ id, item: "", price: null }, { id });
  };

  const handleCellClick = (params) => {
    const { id, field } = params;

    // const clickedRow = itemRows.find((row) => row.id === id);
    // console.log("clickedRow", clickedRow);

    if (id === -1 || id === "totals" || ["item", "price", "placeholder", "actions"].includes(field)) {
      return;
    }

    setItemRows((prevRows) => {
      return prevRows.map((row) => {
        if (row.id === id) {
          const updatedRow = { ...row, [field]: !row[field] }; // Toggle cell value

          // Calculate participant count
          const participants = userCols.filter((col) =>
            col.field === field ? !row[field] : !!row[col.field],
          ).length;

          // Calculate split amount
          const splitAmount = participants > 0 ? (row.price / participants).toFixed(2) : 0;

          userCols.forEach((col) => {
            const isParticipating = col.field === field ? !row[field] : !!row[col.field];
            updatedRow[col.field] = isParticipating ? splitAmount : false;
          });

          console.log("updatedRow", updatedRow);
          return updatedRow;
        }
        return row;
      });
    });
    //totals updated from useEffect
  };

  const addRow = (rowData) => {
    setItemRows((prevRows) => {
      const newRow = {
        id: prevRows.length + 1,
        item: rowData.item || "",
        price: parseFloat(rowData.price?.toFixed(2)) || null,
      };
      return [...prevRows, newRow];
    });
  };

  const recalculateShares = (currentRows, currentColumns) => {
    return currentRows.map((row) => {
      const updatedRow = { ...row };

      // Count participants for this row
      const participants = currentColumns.filter((col) => !!row[col.field]).length; // Only count fields that are true for this row

      // Calculate new split amount
      const splitAmount = participants > 0 ? (row.price / participants).toFixed(2) : 0;

      // Update amounts for all participating columns
      currentColumns.forEach((col) => {
        updatedRow[col.field] = !!row[col.field] ? parseFloat(splitAmount) : false; // Assign splitAmount only if participating, otherwise false
      });

      return updatedRow;
    });
  };

  const calculateTotals = (rows, columns) => {
    const initialTotals = columns.reduce(
      (totals, col) => {
        totals[col.field] = 0; // Initialize person totals
        return totals;
      },
      { price: 0 },
    ); // Initialize price total

    // Safely reduce rows to calculate totals
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

    return { ...totals, id: "totals", item: "TOTAL" };
  };

  const processRowUpdate = (newRow, oldRow) => {
    return new Promise((resolve) => {
      let resRow = newRow;
      if (newRow.id === -1 && (newRow.price !== null || newRow.item.trim())) {
        addRow(newRow);
        resolve({ id: -1, item: "", price: null });
      } else {
        setItemRows((prevRows) => {
          const roundedPrice = parseFloat(newRow.price?.toFixed(2));
          newRow.price = roundedPrice;

          // Update the specific row
          const updatedRows = prevRows.map((row) => (row.id === newRow.id ? newRow : row));

          let newShare = recalculateShares(updatedRows, userCols);

          resRow = newShare.find((row) => row.id === newRow.id);
          // console.log("newShare", newShare);
          return newShare;
        });

        resolve(resRow);
      }
    });
  };

  const handleColumnResize = (col) => {
    if (col.colDef.field === "item") {
      setFirstColumnWidth(col.width);
      // setColor("red");
    }
  };

  return (
    <div>
      <Paper>
        <DataGrid
          rows={rows}
          columns={columns}
          disableColumnSorting
          disableColumnMenu
          rowHeight={40}
          disableRowSelectionOnClick
          getRowId={(row) => row.id}
          showCellVerticalBorder
          onCellClick={(params) => handleCellClick(params)}
          hideFooter
          processRowUpdate={processRowUpdate}
          onProcessRowUpdateError={(error) => console.log("Error:", error)}
          disableVirtualization
          isCellEditable={(params) =>
            params.row.id !== "totals" || (params.row.id == -1 && params.field == "price")
          }
          onColumnWidthChange={handleColumnResize}
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
      </Paper>

      <div style={{ color: "red" }}>{errorMessage}</div>
      <Button variant="contained" color="secondary" onClick={createReceipt} disabled={isButtonDisabled}>
        Create Receipt
      </Button>
      {/* <Button variant="contained" color="secondary" onClick={test}> */}
      {/*   view grid */}
      {/* </Button> */}
    </div>
  );
};

export default SplitGrid;
