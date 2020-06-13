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

const updateUserLastActivityDate = async (message) => {
  if (
    message.chat.type !== 'supergroup' ||
    message.chat.id != process.env.GROUP_ID
  )
    return;
  await User.findOneAndUpdate(
    {
      id: message.from.id,
    },
    {
      lastActivityDate: Date(message.date),
    }
  );
};

const onStart = async (message) => {
  if (message.chat.type === 'private')
    bot.sendMessage(message.chat.id, 'خوش اومدی :)', {
      reply_markup: JSON.stringify({
        keyboard: [['آمار فعالیت'], ['چیا یادگرفتم؟']],
        resize_keyboard: true,
        one_time_keyboard: true,
      }),
      reply_to_message_id: message.message_id,
    });
};

const getUsers = async (message) => {
  if (
    message.from.id != process.env.ADMIN_USER_ID ||
    message.chat.type !== 'private'
  )
    return;
  const users = await User.find();
  let usersListMessage = '';
  users.forEach((user) => {
    usersListMessage = `${usersListMessage}

شناسه: <a href="tg://user?id=${user.id}">${user.id}</a>
وضعیت فعالیت: ${user.isActive ? 'فعال' : 'غیرفعال'}
تاریخ عضویت اولیه: ${moment
      .utc(user.joinDate)
      .add({ hours: 4, minutes: 30 })
      .format('jYYYY/jMM/jDD H:m:s')}
تاریخ آخرین فعالیت: ${moment
      .utc(user.lastActivityDate)
      .add({ hours: 4, minutes: 30 })
      .format('jYYYY/jMM/jDD H:m:s')}`;
  });
  bot.sendMessage(message.chat.id, usersListMessage, {
    parse_mode: 'HTML',
    reply_to_message_id: message.message_id,
  });
};

const getStatistics = async (message) => {
  if (message.chat.type != 'private') return;

  const user = await User.findOne({
    id: message.from.id,
  });
  if (user === null)
    return bot.sendMessage(
      message.chat.id,
      'اطلاعاتی از شما در دیتابیس وجود ندارد',
      {
        reply_to_message_id: message.message_id,
      }
    );

  const lastActivityJalaliDate = moment
    .utc(user.lastActivityDate)
    .add({
      hours: 4,
      minutes: 30,
    })
    .format('jYYYY/jMM/jDD HH:mm:ss');
  const joinJalaliDate = moment
    .utc(user.joinDate)
    .add({
      hours: 4,
      minutes: 30,
    })
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
    {
      reply_to_message_id: message.message_id,
    }
  );
};

const getBestStudent = async (message) => {
  if (
    message.chat.type !== 'private' ||
    message.from.id != process.env.ADMIN_USER_ID
  )
    return;
  let students = await Message.aggregate([
    {
      $sortByCount: '$learnerId',
    },
  ]);
  const bestStudent = students[0];
  bot.sendMessage(
    message.chat.id,
    `
  بهترین یادگیرنده: <a href="tg://user?id=${bestStudent._id}">${bestStudent._id}</a> ✌
  تعداد چیزهای یادگرفته شده: ${bestStudent.count} 😉
`,
    {
      parse_mode: 'HTML',
      reply_to_message_id: message.message_id,
    }
  );
};

const getBestTeacher = async (message) => {
  let teachers = await Message.aggregate([
    {
      $sortByCount: '$senderId',
    },
  ]);
  const bestTeacher = teachers[0];
  bot.sendMessage(
    message.chat.id,
    `
  بهترین یاددهنده: <a href="tg://user?id=${bestTeacher._id}">${bestTeacher._id}</a> ✌
  تعداد چیزهای یادداده شده: ${bestTeacher.count} 😉
`,
    {
      parse_mode: 'HTML',
      reply_to_message_id: message.message_id,
    }
  );
};

const getLearnfulDate = async (message) => {
  if (
    message.chat.type !== 'private' ||
    message.from.id != process.env.ADMIN_USER_ID
  )
    return;
  const messagesSortedByCountOfLearnDate = await Message.aggregate([
    {
      $project: {
        year: {
          $year: '$learnDate',
        },
        month: {
          $month: '$learnDate',
        },
        day: {
          $dayOfMonth: '$learnDate',
        },
      },
    },
    {
      $project: {
        date: {
          year: '$year',
          month: '$month',
          day: '$day',
        },
      },
    },
    {
      $sortByCount: '$date',
    },
  ]);
  const learnFulDate = moment(
    new Date(
      messagesSortedByCountOfLearnDate[0]._id.year,
      messagesSortedByCountOfLearnDate[0]._id.month,
      messagesSortedByCountOfLearnDate[0]._id.day
    )
  );

  bot.sendMessage(message.chat.id, learnFulDate.format('jYYYY/jMM/jDD'), {
    reply_to_message_id: message.message_id,
  });
};

const getThingsILearned = async (message, page = 1, messageId = null) => {
  message.from.id = messageId === null ? message.from.id : message.chat.id;
  const messages = await Message.find({
    learnerId: message.from.id,
  })
    .sort({ learnDate: -1 })
    .skip((page - 1) * 5)
    .limit(5);
  if (messages.length === 0 && messageId === null)
    return bot.sendMessage(message.chat.id, 'چیزی نیست😢', {
      reply_to_message_id: message.message_id,
    });
  if (messages.length === 0 && messageId !== null)
    return bot.editMessageText('چیزی نیست 😢', {
      chat_id: message.chat.id,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: '◀️جدید ترها',
              callback_data: `page:${page - 1}-messageId:${message.message_id}`,
            },
          ],
        ],
      },
    });

  const keyboard = [];
  messages.forEach((learnedMessage, index) => {
    const key = {
      text: (page - 1) * 5 + (index + 1),
      url: `https://t.me/c/${process.env.GROUP_ID.substr(
        4,
        Number.MAX_SAFE_INTEGER
      )}/${learnedMessage.id}`,
    };
    keyboard.push([key]);
  });
  if (messages.length === 5 && page === 1) {
    keyboard.push([
      {
        text: 'قدیمی ترها▶️',
        callback_data: `page:${page + 1}-messageId:${
          messageId === null ? message.message_id + 1 : message.message_id
        }`,
      },
    ]);
  } else if (messages.length === 5 && page > 1) {
    keyboard.push([
      {
        text: '◀️جدید ترها',
        callback_data: `page:${page - 1}-messageId:${message.message_id}`,
      },
      {
        text: 'قدیمی ترها▶️',
        callback_data: `page:${page + 1}-messageId:${message.message_id}`,
      },
    ]);
  } else if (messages.length >= 1 && page > 1) {
    keyboard.push([
      {
        text: '◀️جدید ترها',
        callback_data: `page:${page - 1}-messageId:${message.message_id}`,
      },
    ]);
  }

  if (messageId !== null) {
    return bot.editMessageText(
      'لیست پیامایی که ازشون چیزی یادگرفتی این پایینه 😊',
      {
        message_id: messageId,
        chat_id: message.chat.id,
        reply_markup: { inline_keyboard: keyboard },
      }
    );
  }
  bot.sendMessage(
    message.chat.id,
    'لیست پیامایی که ازشون چیزی یادگرفتی این پایینه 😊',
    {
      reply_markup: { inline_keyboard: keyboard },
      reply_to_message_id: message.message_id,
    }
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
    id: message.reply_to_message.message_id,
  });
  if (learnedMessage)
    return bot.deleteMessage(message.chat.id, message.message_id);

  await Message.create({
    id: message.reply_to_message.message_id,
    senderId: message.reply_to_message.from.id,
    learnerId: message.from.id,
    learnDate: Date(message.date),
  });
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

  await User.findOneAndUpdate(
    {
      id: deletedUser.id,
    },
    {
      isActive: false,
    }
  );
  bot.deleteMessage(message.chat.id, message.message_id);
  bot.sendMessage(
    process.env.ADMIN_USER_ID,
    `وضعیت کاربر <a href="tg://user?id=${deletedUser.id}">${deletedUser.first_name}</a> به غیرفعال تغییر پیدا کرد`,
    {
      parse_mode: 'HTML',
    }
  );
};

const undefinedAction = (message) => {
  if (message.chat.type === 'private')
    bot.sendMessage(message.chat.id, 'نفهمیدم چی گفتی!', {
      reply_markup: JSON.stringify({
        keyboard: [['آمار فعالیت'], ['چیا یادگرفتم؟']],
        resize_keyboard: true,
        one_time_keyboard: true,
      }),
      reply_to_message_id: message.message_id,
    });
};

const ALLOWED_MESSAGE_TYPE_FOR_UPDATING_LAST_ACTIVITY = [
  'text',
  'photo',
  'video',
  'voice',
  'poll',
];

bot.on('callback_query', (callback) => {
  const action = callback.data;
  const message = callback.message;

  const pattern = /page:([0-9]+)-messageId:([0-9]+)/.exec(action);

  if (!pattern) return;
  const page = +pattern[1];
  const messageId = +pattern[2];

  getThingsILearned(message, page, messageId);
});
bot.on('message', async (message, metadata) => {
  // send user message to log channel
  if (
    process.env.NODE_ENV === 'production' &&
    message.chat.type === 'private'
  ) {
    await bot.sendMessage(
      process.env.LOG_CHANNEL_ID,
      `پیام جدید از <a href="tg://user?id=${message.from.id}">${message.from.first_name}</a> گرفتم ✌`,
      { parse_mode: 'HTML' }
    );
    bot.forwardMessage(
      process.env.LOG_CHANNEL_ID,
      message.chat.id,
      message.message_id
    );
  }

  if (ALLOWED_MESSAGE_TYPE_FOR_UPDATING_LAST_ACTIVITY.includes(metadata.type))
    updateUserLastActivityDate(message);

  if (metadata.type === 'new_chat_members') onNewMembersJoined(message);
  else if (metadata.type === 'left_chat_member') onMemberLeft(message);

  let learnedNewThing = /^\+|⁺|＋|﹢$/.exec(message.text);
  if (learnedNewThing) onLearnedNewThing(message);

  if (message.chat.type != 'private') return;

  if (metadata.type !== 'text') return undefinedAction(message);

  let startCommand = /^\/start$/.exec(message.text);
  let getUsersCommand = /^\/getUsers$/.exec(message.text);
  let specificUserStatCommand = /^\/stat (.+)$/.exec(message.text);
  let bestStudentCommand = /^\/bestStudent$/.exec(message.text);
  let bestTeacherCommand = /^\/bestTeacher$/.exec(message.text);
  let learnfulDateCommand = /^\/learnfulDate$/.exec(message.text);
  let statCommand = /^\/stat$/.exec(message.text);
  let statKeyboard = /^آمار فعالیت$/.exec(message.text);
  let thingsILearned = /^\/thingsILearned$/.exec(message.text);
  let thingsILearnedKeyboard = /^چیا یادگرفتم؟$/.exec(message.text);

  if (startCommand) onStart(message);
  else if (getUsersCommand) getUsers(message);
  else if (
    specificUserStatCommand &&
    message.from.id == process.env.ADMIN_USER_ID
  ) {
    message.from.id = specificUserStatCommand[1];
    return getStatistics(message);
  } else if (bestStudentCommand) getBestStudent(message);
  else if (bestTeacherCommand) getBestTeacher(message);
  else if (learnfulDateCommand) getLearnfulDate(message);
  else if (statCommand) getStatistics(message);
  else if (statKeyboard) getStatistics(message);
  else if (thingsILearned) getThingsILearned(message, 1);
  else if (thingsILearnedKeyboard) getThingsILearned(message, 1);
  else undefinedAction(message);
});

module.exports = bot;
