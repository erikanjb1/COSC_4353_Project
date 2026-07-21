const path = require("node:path");
const express = require("express");

const queueRoutes = require("./routes/queueRoutes");
const HttpError = require("./utils/httpError");

const app = express();

const frontendPath = path.join(
  __dirname,
  "../../frontend"
);

// Read JSON request bodies
app.use(
  express.json({
    limit: "20kb"
  })
);

// Backend health check
app.get("/api/health", function (_req, res) {
  res.status(200).json({
    success: true,
    message: "QueueSmart API is running."
  });
});

// Backend Queue Management APIs
app.use("/api/queues", queueRoutes);

// Invalid API routes
app.use("/api", function (_req, _res, next) {
  next(
    new HttpError(
      404,
      "API route was not found."
    )
  );
});

// Clean front-end page routes
app.get("/", function (_req, res) {
  res.sendFile(
    path.join(frontendPath, "index.html")
  );
});

app.get("/admin", function (_req, res) {
  res.sendFile(
    path.join(frontendPath, "admin.html")
  );
});

app.get("/login", function (_req, res) {
  res.sendFile(
    path.join(frontendPath, "login.html")
  );
});

app.get("/register", function (_req, res) {
  res.sendFile(
    path.join(frontendPath, "register.html")
  );
});


app.use(express.static(frontendPath));

// Invalid website routes
app.use(function (_req, _res, next) {
  next(
    new HttpError(
      404,
      "Page was not found."
    )
  );
});

// Error handler
app.use(function (error, _req, res, _next) {
  const status = Number.isInteger(error.status)
    ? error.status
    : 500;

  res.status(status).json({
    success: false,

    error: {
      message:
        status === 500
          ? "Internal server error."
          : error.message,

      ...(error.details
        ? {
            details: error.details
          }
        : {})
    }
  });
});

module.exports = app;