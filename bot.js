const TelegramBot = require('node-telegram-bot-api');

const User = require('./User');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
  polling: true,
});

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

  newMembers.forEach(async (user) => {
    if (user.is_bot) return;
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

bot.onText(/\/removeInactiveUsers/, async (message) => {
  if (
    message.chat.type === 'private' &&
    message.from.id == process.env.ADMIN_USER_ID
  ) {
    const users = await User.find();
    const yesterday = new Date().getTime() - 1000 * 60 * 60 * 24;
    users.forEach((user) => {
      const lastActivityDate = new Date(user.lastActivityDate);
      if (lastActivityDate.getTime() < yesterday) {
        bot.kickChatMember(process.env.GROUP_ID, user.id);
        bot.sendMessage(
          message.chat.id,
          `کاربر <a href="tg://user?id=${user.id}">${user.id}</a> ریمو شد`,
          {
            reply_to_message_id: message.message_id,
            parse_mode: 'HTML',
          }
        );
      }
    });
    bot.sendMessage(message.chat.id, 'عملیات با موفقیت انجام شد', {
      reply_to_message_id: message.message_id,
    });
  }
});

module.exports = bot;
