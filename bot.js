const TelegramBot = require('node-telegram-bot-api');
const JDate = require('jalali-date');

const User = require('./models/User');
const Message = require('./models/Message');

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
    const numberOfLearnedThings = await Message.countDocuments({
      learnerId: message.from.id,
    });
    const numberOfTaughtThings = await Message.countDocuments({
      senderId: message.from.id,
    });
    bot.sendMessage(
      message.chat.id,
      `
    تعداد چیزایی که یاد گرفتید: ${numberOfLearnedThings} 👌
تعداد دفعاتی که بقیه از پیام های شما چیزی رو یاد گرفتن: ${numberOfTaughtThings} 😊
تاریخ و ساعت آخرین فعالیتی که ثبت شده: ${lastActivityJalaliDate.format(
        'YYYY/MM/DD '
      )} ${user.lastActivityDate.getHours()}:${user.lastActivityDate.getMinutes()}:${user.lastActivityDate.getSeconds()} ✌
    `,
      { reply_to_message_id: message.message_id }
    );
  }
});

bot.onText(/^\+|⁺|＋|﹢$/, async (message) => {
  if (
    message.chat.type !== 'supergroup' ||
    message.chat.id != process.env.GROUP_ID ||
    !message.reply_to_message ||
    message.reply_to_message.from.id == message.from.id
  ) {
    return bot.deleteMessage(message.chat.id, message.message_id);
  }
  const learnedMessage = await Message.findOne({
    learnerId: message.from.id,
    senderId: message.reply_to_message.from.id,
  });
  if (learnedMessage)
    return bot.deleteMessage(message.chat.id, message.message_id);

  await Message.create({
    id: message.message_id,
    senderId: message.reply_to_message.from.id,
    learnerId: message.from.id,
  });

  await User.findOneAndUpdate(
    { id: message.from.id },
    { $inc: { numberOfLearnedThings: 1 } }
  );
  await User.findOneAndUpdate(
    { id: message.reply_to_message.from.id },
    { $inc: { numberOfTaughtThings: 1 } }
  );
});

const addAdminToDB = async (adminID, messageDate) => {
  const updatedUser = await User.findOneAndUpdate(
    {
      id: adminID,
    },
    {
      isActive: true,
      lastActivityDate: Date(messageDate),
    }
  );
  if (!updatedUser)
    await User.create({
      id: adminID,
      lastActivityDate: Date(messageDate),
    });
};

bot.on('new_chat_members', (message) => {
  const newMembers = message.new_chat_members;
  bot.deleteMessage(message.chat.id, message.message_id);
  newMembers.forEach(async (user) => {
    if (user.is_bot && user.id == process.env.BOT_ID)
      addAdminToDB(process.env.ADMIN_USER_ID, message.date);
    if (user.is_bot) return;
    const updatedUser = await User.findOneAndUpdate(
      {
        id: user.id,
      },
      {
        isActive: true,
        lastActivityDate: Date(message.date),
      }
    );
    if (!updatedUser)
      await User.create({ id: user.id, lastActivityDate: Date(message.date) });

    bot.sendMessage(
      process.env.ADMIN_USER_ID,
      `وضعیت کاربر <a href="tg://user?id=${user.id}">${user.first_name}</a> به فعال تغییر پیدا کرد`,
      {
        parse_mode: 'HTML',
      }
    );
  });
});

bot.on('left_chat_member', async (message) => {
  const deletedUser = message.left_chat_member;
  if (deletedUser.is_bot) return;
  await User.findOneAndUpdate({ id: deletedUser.id }, { isActive: false });
  bot.deleteMessage(message.chat.id, message.message_id);
  bot.sendMessage(
    process.env.ADMIN_USER_ID,
    `وضعیت کاربر <a href="tg://user?id=${deletedUser.id}">${deletedUser.first_name}</a> به غیرفعال تغییر پیدا کرد`,
    {
      parse_mode: 'HTML',
    }
  );
});

module.exports = bot;
