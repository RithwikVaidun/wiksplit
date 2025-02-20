import { useRef, useState, useEffect, useMemo } from "react";
import {
  GridActionsCellItem,
  DataGrid,
  GridColumnMenu,
} from "@mui/x-data-grid";
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

  async function test() {
    for (let i = 0; i < rows.length; i++) {
      console.log(rows[i]);
      // console.log(rows[i].id, rows[i].item, rows[i].price);
    }

    for (let i = 0; i < columns.length - 1; i++) {
      // console.log(columns[i].field, columns[i].headerName);
      console.log(columns[i]);
    }
    // console.log("rows", rows);
    // console.log("columns", columns);
  }

  const [rows, setRows] = useState([]);
  const [columns, setColumns] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const gridRef = useRef(null);
  const [firstColumnWidth, setFirstColumnWidth] = useState(100);

  const createReceipt = async () => {
    const validRows = rows
      .filter((row) => row.id !== -1 && row.id !== "totals")
      .map(({ id, ...rest }) => rest);

    const validColumns = columns
      .filter(
        (col) =>
          col.field !== "placeholder" &&
          col.field !== "item" &&
          col.field !== "price" &&
          col.field !== "actions",
      )
      .map((field) => field.headerName);

    // console.log("sending these rows to backend", validRows);
    // console.log("sending these cols to backend", validColumns);

    try {
      const res = await apiClient.post("/createRec", {
        rows: validRows,
        columns: validColumns,
        creator_id: user.id,
      });

      setRID(res.data.id);
    } catch (error) {
      console.error("Error creating receipt:", error);
    }
    // resetGrid();
  };

  const isButtonDisabled = useMemo(() => {
    if (!user) {
      setErrorMessage("Please login to create receipt");
      return true;
    }
    let r = rows.filter((row) => row.id !== -1 && row.id !== "totals");
    if (r.length === 0) {
      setErrorMessage("Add at least 1 item");
      return true;
    }

    for (let i = 0; i < r.length; i++) {
      if (!r[i].item || r[i].item.trim() === "") {
        setErrorMessage("Item name cannot be empty");
        return true;
      }
      if (r[i].price === null || r[i].price < 0.01 || isNaN(r[i].price)) {
        setErrorMessage(`${rows[i].item} price is invalid`);
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

    let cols = columns.filter(
      (col) =>
        col.field !== "placeholder" &&
        col.field !== "actions" &&
        col.field !== "item" &&
        col.field !== "price",
    );

    const duplicateField = dups(cols);
    if (duplicateField) {
      setErrorMessage(`Name "${duplicateField}" is already used`);
      return true;
    }
    if (cols.length < 2) {
      setErrorMessage("Add at least 2 users");
      return true;
    }

    for (let i = 0; i < cols.length; i++) {
      const field = cols[i].headerName;
      if (
        typeof field !== "string" ||
        !field ||
        field.trim() === "" ||
        !/^[A-Za-z]+$/.test(field)
      ) {
        setErrorMessage(`Columns ${field} empty or invalid`);
        return true;
      }
    }

    setErrorMessage("");
    return false;
  }, [rows, columns]);

  // columns
  useEffect(() => {
    const actionsColumn = {
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
    };
    const staticColumns = [
      {
        field: "item",
        pinned: "left",
        width: firstColumnWidth,
        headerName: "Item",
        editable: true,
        renderCell: (params) => {
          if (params.id === -1) {
            return (
              <TextField
                // value={place}
                variant="standard"
                placeholder="add item"
              ></TextField>
            );
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
            return "";
          }
          return `$${Number(value).toFixed(2)}`;
        },
        renderCell: (params) => {
          if (params.id === -1)
            return (
              <TextField
                variant="standard"
                placeholder="price"
                type="number"
              ></TextField>
            );
        },
      },
    ];

    const dynamicColumns = initialColumns.map((user) => ({
      field: user.username,
      headerName: user.username,
      renderCell: renderPersonCell,
      width: 105,
      renderHeader: (params) => <CustomHeader {...params} />,
      cellClassName: (params) =>
        clsx(styles.splitCell, {
          [styles.selectedCell]: !!params.value,
        }),
    }));

    const names = initialColumns.map((user) => user.username);

    const placeholderColumn = {
      field: "placeholder",
      headerName: "",
      sortable: false,
      editable: false,
      disableClickEventBubbling: true,
      renderHeader: (params) => <EditableHeader {...params} columns={names} />,
      renderCell: () => null,
    };

    setColumns([
      actionsColumn,
      ...staticColumns,
      ...dynamicColumns,
      placeholderColumn,
    ]);
  }, [initialColumns]);

  // rows
  // const [totalsRow, setTotalsRow] = useState({ item: "TOTAL", price: null });

  useEffect(() => {
    const dataRows = initialRows.map((row, index) => ({
      ...row,
      id: index + 1,
    }));

    const placeholderRow = {
      id: -1,
      item: "",
      price: null,
    };

    const totals = calculateTotals(dataRows, columns);
    const totalsRow = {
      id: "totals",
      item: "TOTAL",
      price: null,
      ...totals,
    };
    // console.log("USE EFF after calling calcTotals", totals);
    // console.log("totalsRow right before seeting", totalsRow);
    setRows([...dataRows, placeholderRow, totalsRow]);
  }, [initialRows]);

  const EditableHeader = ({ colDef, columns }) => {
    const { field } = colDef;
    const [inputValue, setInputValue] = useState("");

    const handleChange = (e) => {
      setInputValue(e.target.value);
      return;
    };

    const handleHeaderChange = (e) => {
      if (field === "placeholder" && inputValue) {
        addColumn(inputValue);
        setInputValue("");
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleHeaderChange();
      }
    };

    return (
      <input
        type="text"
        value={field === "placeholder" ? inputValue : colDef.headerName}
        onChange={handleChange}
        placeholder={field === "placeholder" ? "Add person.." : ""}
        onBlur={handleHeaderChange}
        onKeyDown={handleKeyDown}
        style={{ width: "100%", border: "none", outline: "none" }}
      />
    );
  };

  const recalculateShares = (currentRows, currentColumns) => {
    return currentRows.map((row) => {
      if (row.id === -1 || row.id === "totals") {
        return row;
      }

      const updatedRow = { ...row };

      // Count participants for this row
      const participants = currentColumns.filter(
        (col) =>
          !["item", "price", "actions"].includes(col.field) && !!row[col.field],
      ).length; // Only count fields that are true for this row

      // Calculate new split amount
      const splitAmount =
        participants > 0 ? (row.price / participants).toFixed(2) : 0;

      // Update amounts for all participating columns
      currentColumns.forEach((col) => {
        if (!["item", "price", "actions"].includes(col.field)) {
          updatedRow[col.field] = !!row[col.field]
            ? parseFloat(splitAmount)
            : false; // Assign splitAmount only if participating, otherwise false
        }
      });

      return updatedRow;
    });
  };

  const handleDeleteColumn = (fieldToDelete) => {
    setColumns((prevColumns) => {
      const newColumns = prevColumns.filter(
        (col) => col.field !== fieldToDelete,
      );

      setRows((prevRows) => {
        const rowsWithDeletedColumn = prevRows.map((row) => {
          const newRow = { ...row };
          delete newRow[fieldToDelete];
          return newRow;
        });

        return recalculateShares(rowsWithDeletedColumn, newColumns);
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
      <div>
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
    const newField = newColumnName.replace(/\s/g, "");
    let names = [];
    setColumns((prevColumns) => {
      names = prevColumns.map((col) => col.field);
      return prevColumns;
    });
    if (names.includes(newField)) {
      setErrorMessage(`Name "${newColumnName}" is already used`);
      return;
    }

    setColumns((prevColumns) => [
      ...prevColumns.slice(0, -1),
      {
        field: newField,
        headerName: newColumnName,
        width: 105,
        renderCell: renderPersonCell,
        renderHeader: (params) => <CustomHeader {...params} />,
        cellClassName: (params) =>
          clsx(styles.splitCell, {
            [styles.selectedCell]: !!params.value,
          }),
      },
      {
        field: "placeholder",
        headerName: "",
        sortable: false,
        width: 100,
        editable: false,
        disableClickEventBubbling: true,
        renderHeader: (params) => (
          <EditableHeader {...params} columns={names} />
        ),
        renderCell: () => null,
      },
    ]);

    setRows((prevRows) =>
      prevRows.map((row) => ({
        ...row,
        [newField]: false,
      })),
    );
    setErrorMessage("");
  };

  const removeRow = (id) => {
    setRows((prevRows) => prevRows.filter((row) => row.id !== id));
    processRowUpdate({ id, item: "", price: null }, { id });
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

    setRows((prevRows) => {
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
        // price: null,
        ...totals,
      };

      return [...updatedRows, totalsRow];
    });
  };

  const addRow = (rowData) => {
    setRows((prevRows) => {
      const totalsRow = prevRows.find((row) => row.id === "totals") || {
        id: "totals",
        item: "TOTAL",
        price: 0,
      };
      const filteredRows = prevRows.filter(
        (row) => row.id !== -1 && row.id !== "totals",
      );

      const newRow = {
        id: prevRows.length + 1,
        item: rowData.item || "",
        price: parseFloat(rowData.price?.toFixed(2)) || null,
      };

      const updatedRows = [
        ...filteredRows,
        newRow,
        { id: -1 },
        {
          ...totalsRow,
          price: calculateTotal(filteredRows, newRow),
        },
      ];
      return updatedRows;
    });

    // setPlace("");
    // setColumns((prevColumns) => prevColumns);
  };

  const calculateTotal = (rows, newRow) => {
    let ans = [...rows, newRow]
      .filter((row) => row && row.id !== -1 && row.id !== "totals")
      .reduce((sum, row) => sum + (parseFloat(row.price) || 0), 0);
    return ans;
  };

  const calculateTotals = (rows = [], columns = []) => {
    const initialTotals = columns.reduce(
      (totals, col) => {
        if (!["item", "price"].includes(col.field)) {
          totals[col.field] = 0;
        }
        return totals;
      },
      { price: 0 },
    );

    const totals = rows.reduce((acc, row) => {
      if (row.id === -1 || row.id === "totals") return acc;

      if (row.price) {
        acc.price += parseFloat(row.price) || 0;
      }

      columns.forEach((col) => {
        if (!["item", "price"].includes(col.field) && row[col.field]) {
          acc[col.field] += parseFloat(row[col.field]) || 0;
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

  useEffect(() => {
    // test();
  }, [rows]);

  const processRowUpdate = (newRow, oldRow) => {
    return new Promise((resolve) => {
      let resRow = newRow;
      if (newRow.id === -1 && (newRow.price !== null || newRow.item.trim())) {
        addRow(newRow);
        resolve({ id: -1, item: "", price: null });
      } else {
        setRows((prevRows) => {
          // console.log("came here");
          const roundedPrice = parseFloat(newRow.price?.toFixed(2));
          newRow.price = roundedPrice;

          const updatedRows = prevRows.map((row) =>
            row.id === newRow.id ? newRow : row,
          );

          let newShare = recalculateShares(updatedRows, columns);

          resRow = newShare.find((row) => row.id === newRow.id);

          let totals = calculateTotals(newShare, columns);
          return [...newShare.filter((row) => row.id !== "totals"), totals];
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
            params.row.id !== "totals" ||
            (params.row.id == -1 && params.field == "price")
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
      <Button
        variant="contained"
        color="secondary"
        onClick={createReceipt}
        disabled={isButtonDisabled}
      >
        Create Receipt
      </Button>
      {/* <Button variant="contained" color="secondary" onClick={test}> */}
      {/*   view grid */}
      {/* </Button> */}
    </div>
  );
};

export default SplitGrid;
