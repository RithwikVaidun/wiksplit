# Overview

Wiksplit is a simple web app that allows users to take a picture of a receipt and split the items amongst a group of people.
Select items that you contributed to and the app will calculate how much you owe. Share receipts with others and view edits in **real-time**

## Demo

https://github.com/user-attachments/assets/b7ec1845-c4e8-4229-adff-92dd465de2f4

## Technologies used

- NextJS for frontend, FastAPI for backend
- Image OCR and LLMs for text extraction and receipt parsing
- Google OAuth2 and JWTs for **secure** user authentication and API access
- SQLite for storing user data and receipt information
- Docker for hosting the backend
- ngrok for mobile testing

## Findings

- learned how signing and verifying tokens work to securely transfer sensitive data between client and server.
- explored how cookies are sent across domains and how they could be exploited through CSRF and XSS attacks.
- fundamentals of Docker for packaging and deploying backend to cloud services.
- designed effecient SQL database schema with automatic updates and deletions using triggers.
- experimented with various preprocessing techniques to improve text extraction accuracy.
- implemented logging file to track and record malicious requests to the API.
- configuring and deploying different environments for development and production.
