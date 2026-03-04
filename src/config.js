module.exports = {
    GROUP_NAME: 'TheSchoolOfTheSpirit📜',
    DONE_KEYWORDS: ['prayer', 'study', 'quiet time'],
    LATE_THRESHOLD_DAYS: 1,
    REMINDER_MESSAGE_TEMPLATE: (name) => `Hi ${name}, please remember to do drill tasks for Mentorship sessions! Remember these drills are for you not only for attendance.`,
};

/*
# Delete the session folder to force new login
Remove-Item -Recurse -Force ./session

# Then run and scan QR again
node src/index.js*/