const express = require('express');
const moment = require('moment-jalaali');

const User = require('./models/User');
const bot = require('./bot');

const app = express();

app.use(express.json());

app.post(`/bot${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.get('/removeInactiveUsers', async (req, res) => {
  if (req.query.security_code != process.env.SECURITY_CODE) {
    return res.json({
      status: 'fail',
      message: 'کد امنیتی اشتباه است',
    });
  }

  const users = await User.find({
    isActive: true,
    lastActivityDate: {
      $lte: moment().utc().subtract(1, 'day').toDate(),
    },
  });

  users.forEach(async (user) => {
    await bot.kickChatMember(process.env.GROUP_ID, user.id);
    await user.updateOne({ isActive: false });
    await bot.sendMessage(
      process.env.ADMIN_USER_ID,
      `<a href="tg://user?id=${user.id}">کاربر</a> به دلیل عدم فعالیت ریمو شد`,
      {
        parse_mode: 'HTML',
      }
    );
  });

  res.json({
    status: 'success',
    message: 'عملیات با موفقیت انجام شد',
  });
});

module.exports = app;
