const TelegramBot = require('node-telegram-bot-api');

const User = require('./User');

let bot;
if (process.env.NODE_ENV === 'development') {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: true,
  });
}
if (process.env.NODE_ENV === 'production') {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
  const url = `${process.env.APP_URL}/bot${process.env.TELEGRAM_BOT_TOKEN}`;
  bot.setWebHook(url);
}

const allowedMessageType = ['text', 'photo', 'video', 'voice', 'poll'];

bot.on('message', async (message, metadata) => {
  if (
    allowedMessageType.includes(metadata.type) &&
    message.chat.type === 'supergroup' &&
    message.chat.id == process.env.GROUP_ID
  ) {
    await User.findOneAndUpdate(
      { id: message.from.id },
      { lastActivityDate: Date(message.date) }
    );
  }
});

bot.on('new_chat_members', (message) => {
  const newMembers = message.new_chat_members;

  bot.deleteMessage(message.chat.id, message.message_id);
  newMembers.forEach(async (user) => {
    if (user.is_bot) return;
    try {
      await User.create({ id: user.id, lastActivityDate: Date(message.date) });
      bot.sendMessage(
        process.env.ADMIN_USER_ID,
        `کاربر <a href="tg://user?id=${user.id}">${user.first_name}</a> به دیتابیس اضافه شد`,
        {
          parse_mode: 'HTML',
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

bot.on('left_chat_member', async (message) => {
  const deletedUser = message.left_chat_member;
  await User.deleteOne({ id: deletedUser.id });
  bot.deleteMessage(message.chat.id, message.message_id);
  bot.sendMessage(
    process.env.ADMIN_USER_ID,
    `کاربر <a href="tg://user?id=${deletedUser.id}">${deletedUser.first_name}</a> از دیتابیس حذف شد`,
    {
      parse_mode: 'HTML',
    }
  );
});

module.exports = bot;
