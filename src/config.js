module.exports = {
    GROUP_NAME: 'Class 1 - TheSchoolOfTheSpirit📜',
    DONE_KEYWORDS: ['prayer', 'study', 'quiet time'],
    LATE_THRESHOLD_DAYS: 2,
    REMINDER_MESSAGE_TEMPLATE: (name) => `Hi👋, Reminder for Drill Tasks for *Class 1 - TheSchoolOfTheSpirit📜* \nRemember these *drills are for your growth not just for attendance.* \n\n*Daily Drills* \n> *Prayer* -> 10mins \n> *Study* -> (5 Pages a Book or 3 Chapters of the Bible) \n> *Quiet Time* -> 10mins. \n\n\`This is an automated reminder. Post Drill messages ONCE every TWO days and you will not be receiving these reminders\`🤝`,
};

/*
# Delete the session folder to force new login
Remove-Item -Recurse -Force ./session

# Then run and scan QR again
node src/index.js*/