const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('API đang hoạt động mượt mà!');
});

app.listen(PORT, () => {
  console.log(`Server is running on: http://localhost:${PORT}`);
});