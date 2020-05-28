const dotenv = require('dotenv');
const mongoose = require('mongoose');
const express = require('express');

const User = require('./User');

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
    app.get('/removeInactiveUsers', async (req, res) => {
      if (req.query.security_code == process.env.SECURITY_CODE) {
        const users = await User.find();
        const yesterday = new Date().getTime() - 1000 * 60 * 60 * 24;
        users.forEach(async (user) => {
          const lastActivityDate = new Date(user.lastActivityDate);
          if (lastActivityDate.getTime() < yesterday) {
            await bot.kickChatMember(process.env.GROUP_ID, user.id);
            await bot.sendMessage(
              message.chat.id,
              `کاربر <a href="tg://user?id=${user.id}">${user.first_name}</a> ریمو شد`,
              {
                reply_to_message_id: message.message_id,
                parse_mode: 'HTML',
              }
            );
          }
        });
        res.json({
          status: 'success',
          message: 'عملیات با موفقیت انجام شد',
        });
      } else {
        res.json({
          status: 'fail',
          message: 'کد امنیتی اشتباست',
        });
      }
    });

    app.listen(process.env.PORT || 3000);
  });
