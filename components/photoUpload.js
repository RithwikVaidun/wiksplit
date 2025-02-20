import { useState, useEffect, useRef } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress"; // Import spinner
// import axios from "axios";
import apiClient from "../context/axios";
import styles from "../styles/Grid.module.css"; // Import the CSS file

export default function PhotoUploader({ setRs }) {
  const [imagePreview, setImagePreview] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Preload an existing image on component mount
  //useEffect(() => {
  //  const loadImage = async () => {
  //    try {
  //      const response = await fetch("/rec.jpg");
  //      const blob = await response.blob();
  //      const file = new File([blob], "rec.jpg", { type: "image/jpeg" });
  //      setImagePreview("/rec.jpg");
  //      setImageFile(file);
  //    } catch (error) {
  //      console.error("Error loading image:", error);
  //      setError("Failed to load initial image");
  //    }
  //  };
  //  loadImage();
  //}, []);

  // Clean up object URL
  useEffect(() => {
    return () => {
      if (imagePreview && imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleButtonClick = () => {
    // Programmatically trigger the hidden file input
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const compressImage = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let width = img.width;
          let height = img.height;

          // Max dimensions
          const MAX_WIDTH = 1600;
          const MAX_HEIGHT = 1600;

          // Calculate new dimensions while maintaining aspect ratio
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          // Add white background to improve contrast
          ctx.fillStyle = "#FFFFFF";
          ctx.fillRect(0, 0, width, height);
          // Draw image with improved quality settings
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              resolve(
                new File([blob], file.name, {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                }),
              );
            },
            "image/jpeg",
            0.85,
          ); // Slightly higher quality for receipt text
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setError(null);
      setIsLoading(true);
      try {
        const compressedFile = await compressImage(file);
        setImageFile(compressedFile);
        setImagePreview(URL.createObjectURL(compressedFile));
        // setImageFile(file);
        // setImagePreview(URL.createObjectURL(file));
      } catch (error) {
        console.error("Error processing image:", error);
        setError("Failed to process image. Please try again.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleUpload = async () => {
    if (!imageFile) {
      setError("Please select an image first");
      return;
    }

    setIsLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append("file", imageFile);

    try {
      // const response = await axios.post(
      //   `${url}/extract-items-prices`,
      //   formData,
      //   {
      //     headers: {
      //       "Content-Type": "multipart/form-data",
      //     },
      //   }
      // );
      const response = await apiClient.post("/extract-items-prices", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const items = response.data.items;
      // console.log(
      //   "Items and prices from backend, set (fetched) hapepning:",
      //   items
      // );
      setRs(items);
    } catch (error) {
      console.error("Failed to extract items and prices:", error);
      setError(
        "Failed to process receipt. Please ensure the image is clear and well-lit.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles["upload-area"]}>
      <h3>Upload Your Receipt</h3>
      <div>
        <input
          type="file"
          accept="image/*"
          // capture="camera"
          ref={fileInputRef}
          onChange={handleImageChange}
          style={{ display: "none" }} // Hides the input visually
        />

        <Button variant="contained" color="primary" onClick={handleButtonClick}>
          Upload Image
        </Button>
      </div>

      {imagePreview && (
        <div>
          <h3>Preview:</h3>
          <img
            src={imagePreview}
            alt="Preview"
            style={{ maxWidth: "300px", marginTop: "10px" }}
          />
        </div>
      )}

      {isLoading ? (
        <CircularProgress style={{ marginTop: "20px" }} />
      ) : (
        <Button
          onClick={handleUpload}
          variant="outlined"
          disabled={!imageFile}
          style={{ marginTop: "20px" }}
        >
          Create Receipt From Image
        </Button>
      )}

      {error && <div style={{ color: "red", marginTop: "10px" }}>{error}</div>}
    </div>
  );
}
