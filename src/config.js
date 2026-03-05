module.exports = {
    GROUP_NAME: 'TheSchoolOfTheSpirit📜',
    DONE_KEYWORDS: ['prayer', 'study', 'quiet time'],
    LATE_THRESHOLD_DAYS: 2,
    REMINDER_MESSAGE_TEMPLATE: (name) => `Hi 👋 ${name}, please remember to do Drill tasks for TheSchoolOfTheSpirit📜 Mentorship sessions! \n\nRemember *these drills are for you NOT only for attendance.* \n\n*Daily Drills* \nPrayer - 10mins \nStudy (5 Pages Book or 2 Chapters Bible) \nQuiet Time - 10mins`,
};

/*
# Delete the session folder to force new login
Remove-Item -Recurse -Force ./session

# Then run and scan QR again
node src/index.js*/