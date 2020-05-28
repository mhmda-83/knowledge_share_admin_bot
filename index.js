const dotenv = require('dotenv');
const mongoose = require('mongoose');
const express = require('express');

const app = express();
app.use(express.json());

dotenv.config();

mongoose
  .connect(process.env.MONGO_CONNECTION_STRING, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('db connected :)');
    const bot = require('./bot');
    app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
      bot.processUpdate(req.body);
      res.sendStatus(200);
    });
    app.listen(process.env.PORT);
  });
