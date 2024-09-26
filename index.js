const express = require('express');
const initialize =require('./api/app.js');
const dotenv =require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8082;

initialize(app);

app.listen(PORT, () => {
    console.log(`Server started on Port: ${PORT}`);
});
