const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

mongoose
  .connect(process.env.MONGO_CONNECTION_STRING, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useFindAndModify: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('db connected :)');
    require('./bot');
  });
