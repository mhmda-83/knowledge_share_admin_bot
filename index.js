const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config();

const mongoConnectionString =
  process.env.NODE_ENV == 'development'
    ? process.env.MONGO_DEVELOPMENT_CONNECTION_STRING
    : process.env.MONGO_PRODUCTION_CONNECTION_STRING;
mongoose
  .connect(mongoConnectionString, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('db connected :)');
    require('./app').listen(process.env.PORT || 3000);
  });
