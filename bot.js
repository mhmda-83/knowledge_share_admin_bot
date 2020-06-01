const TelegramBot = require('node-telegram-bot-api');
const moment = require('moment-jalaali');
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

const ALLOWED_MESSAGE_TYPE = ['text', 'photo', 'video', 'voice', 'poll'];

const onMessage = async (message, metadata) => {
  if (
    ALLOWED_MESSAGE_TYPE.includes(metadata.type) &&
    message.chat.type === 'supergroup' &&
    message.chat.id == process.env.GROUP_ID
  ) {
    await User.findOneAndUpdate(
      { id: message.from.id },
      { lastActivityDate: Date(message.date) }
    );
  }
};

const onStart = async (message) => {
  if (message.chat.type === 'private')
    await bot.sendMessage(message.chat.id, 'خوش اومدی :)', {
      reply_to_message_id: message.message_id,
    });
};

const getUserIds = async (message) => {
  if (
    message.from.id != process.env.ADMIN_USER_ID ||
    message.chat.type !== 'private'
  )
    return;
  const users = await User.find();
  let usersListMessage = '';
  users.forEach((user) => {
    usersListMessage = `${usersListMessage}\n<a href="tg://user?id=${user.id}">${user.id}</a>`;
  });
  bot.sendMessage(message.chat.id, usersListMessage, { parse_mode: 'HTML' });
};

const getStatistics = async (message) => {
  if (message.chat.type != 'private') return;

  const user = await User.findOne({ id: message.from.id });
  if (user === null)
    return bot.sendMessage(
      message.chat.id,
      'اطلاعاتی از شما در دیتابیس وجود ندارد',
      { reply_to_message_id: message.message_id }
    );

  const lastActivityJalaliDate = moment
    .utc(user.lastActivityDate)
    .add({ hours: 4, minutes: 30 })
    .format('jYYYY/jMM/jDD HH:mm:ss');
  const joinJalaliDate = moment
    .utc(user.joinDate)
    .add({ hours: 4, minutes: 30 })
    .format('jYYYY/jMM/jDD HH:mm:ss');

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
تاریخ و ساعت آخرین فعالیتی که ثبت شده: ${lastActivityJalaliDate} ✌
تاریخ عضویت: ${joinJalaliDate} 😘
وضعیت در گروه: ${user.isActive ? 'فعال' : 'غیرفعال'}
    `,
    { reply_to_message_id: message.message_id }
  );
};

const onLearnedNewThing = async (message) => {
  if (
    message.chat.type !== 'supergroup' ||
    message.chat.id != process.env.GROUP_ID ||
    !message.reply_to_message ||
    message.reply_to_message.from.id == message.from.id
  )
    return bot.deleteMessage(message.chat.id, message.message_id);
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
    learnDate: message.date,
  });

  await User.findOneAndUpdate(
    { id: message.from.id },
    { $inc: { numberOfLearnedThings: 1 } }
  );
  await User.findOneAndUpdate(
    { id: message.reply_to_message.from.id },
    { $inc: { numberOfTaughtThings: 1 } }
  );
};

const addUserToDB = async (userId, messageDate, userFirstName = 'ادمین') => {
  const updatedUser = await User.findOneAndUpdate(
    {
      id: userId,
    },
    {
      isActive: true,
      lastActivityDate: Date(messageDate),
    }
  );
  if (!updatedUser) {
    await User.create({
      id: userId,
      lastActivityDate: Date(messageDate),
    });
    return bot.sendMessage(
      process.env.ADMIN_USER_ID,
      `کاربر <a href="tg://user?id=${userId}">${userFirstName}</a> به دیتابیس اضافه شد`,
      {
        parse_mode: 'HTML',
      }
    );
  }
  bot.sendMessage(
    process.env.ADMIN_USER_ID,
    `وضعیت کاربر <a href="tg://user?id=${userId}">${userFirstName}</a> به فعال تغییر پیدا کرد`,
    {
      parse_mode: 'HTML',
    }
  );
};

const onNewMembersJoined = (message) => {
  const newMembers = message.new_chat_members;
  bot.deleteMessage(message.chat.id, message.message_id);

  newMembers.forEach(async (user) => {
    if (user.is_bot && user.id == process.env.BOT_ID) {
      console.log(`GROUP ID: ${message.chat.id}`);
      addUserToDB(process.env.ADMIN_USER_ID, message.date);
    }
    if (user.is_bot) return;
    addUserToDB(user.id, message.date, user.first_name);
  });
};

const onMemberLeft = async (message) => {
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
};

bot.on('message', onMessage);
bot.onText(/^\/start$/, onStart);
bot.onText(/^\/getUserIds$/, getUserIds);
bot.onText(/\/stat (.+)/, (message, match) => {
  if (message.from.id == process.env.ADMIN_USER_ID) {
    message.from.id = match[1];
    getStatistics(message);
  }
});
bot.onText(/^\/stat$/, getStatistics);
bot.onText(/^\+|⁺|＋|﹢$/, onLearnedNewThing);
bot.on('new_chat_members', onNewMembersJoined);
bot.on('left_chat_member', onMemberLeft);

module.exports = bot;
