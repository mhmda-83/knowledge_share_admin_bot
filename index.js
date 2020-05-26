const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

const User = require('./User');

dotenv.config();

mongoose
  .connect(process.env.MONGO_CONNECTION_STRING, {
    useCreateIndex: true,
    useNewUrlParser: true,
    useFindAndModify: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('db connected :)'));

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

bot.on('new_chat_members', (message) => {
  const newMembers = message.new_chat_members;

  newMembers.forEach(async (user) => {
    try {
      await User.create({ id: user.id, lastActivityDate: Date(message.date) });
      bot.sendMessage(
        message.chat.id,
        `کاربر ${user.first_name} به دیتابیس اضافه شد`,
        {
          reply_to_message_id: message.message_id,
        }
      );
    } catch (err) {
      if (err.code)
        if (err.code === 11000)
          bot.sendMessage(
            message.chat.id,
            `کاربر ${user.first_name} قبلا در دیتابیس وجود داشته است`,
            {
              reply_to_message_id: message.message_id,
            }
          );
    }
  });
});
