const app = require("./src/app");
require("dotenv").config();

const PORT = Number(process.env.PORT || 5050);

app.listen(PORT, () => {
  console.log(`MeterIQ API listening on http://localhost:${PORT}`);
});
