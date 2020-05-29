const TelegramBot = require('node-telegram-bot-api');
const JDate = require('jalali-date');

const User = require('./models/User');

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

bot.onText(/\/start/, (message) => {
  if (message.chat.type === 'private')
    bot.sendMessage(message.chat.id, 'خوش اومدی :)', {
      reply_to_message_id: message.message_id,
    });
});

bot.onText(/\/stat/, async (message) => {
  if (message.chat.type === 'private') {
    const user = await User.findOne({ id: message.from.id });
    if (user === null)
      return bot.sendMessage(
        message.chat.id,
        'اطلاعاتی از شما در دیتابیس وجود ندارد',
        { reply_to_message_id: message.message_id }
      );
    const lastActivityJalaliDate = new JDate(user.lastActivityDate);
    bot.sendMessage(
      message.chat.id,
      `
    تعداد چیزایی که یاد گرفتید: ${user.numberOfLearnedThings} 👌
تعداد دفعاتی که بقیه از پیام های شما چیزی رو یاد گرفتن: ${
        user.numberOfTaughtThings
      } 😊
تاریخ و ساعت آخرین فعالیتی که ثبت شده: ${lastActivityJalaliDate.format(
        'YYYY/MM/DD '
      )} ${user.lastActivityDate.getHours()}:${user.lastActivityDate.getMinutes()}:${user.lastActivityDate.getSeconds()} ✌
    `,
      { reply_to_message_id: message.message_id }
    );
  }
});

bot.onText(/^\+$/, async (message) => {
  if (
    message.chat.type === 'supergroup' &&
    message.chat.id == process.env.GROUP_ID &&
    message.reply_to_message &&
    message.reply_to_message.from.id != message.from.id
  ) {
    await User.findOneAndUpdate(
      { id: message.from.id },
      { $inc: { numberOfLearnedThings: 1 } }
    );
    await User.findOneAndUpdate(
      { id: message.reply_to_message.from.id },
      { $inc: { numberOfTaughtThings: 1 } }
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
