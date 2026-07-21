const app = require("./app");

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, function () {
  console.log(
    `QueueSmart is running at http://localhost:${PORT}`
  );
});