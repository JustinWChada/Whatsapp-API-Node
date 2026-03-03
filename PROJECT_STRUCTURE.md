# WhatsApp Mentorship Bot - Project Structure

## 📋 Project Overview

**WhatsApp Mentorship Bot** is an automated mentorship tracking system that monitors WhatsApp group messages and manages mentee completion records. The bot automatically tracks when mentees complete tasks (marked by keywords), logs their progress, and sends automated reminders to those who fall behind schedule.

### Core Features:
- ✅ Real-time WhatsApp group message monitoring
- ✅ Automatic task completion tracking
- ✅ Mentee management and data persistence
- ✅ Daily automated reminder scheduler
- ✅ Activity logging and history tracking
- ✅ Auto-population of mentees from WhatsApp group

---

## 📁 Project Directory Structure

```
Whatsapp-API-Node/
│
├── 📄 package.json              # Node.js dependencies and scripts
├── 📄 Dockerfile                # Docker containerization config
├── 📄 .gitignore                # Git ignore rules
├── 📄 dependencies.txt           # Additional dependencies list
├── 📄 ERROR_REPORT.md           # Bug fixes and error documentation
├── 📄 PROJECT_STRUCTURE.md      # This file
│
├── 📁 src/                      # Main source code directory
│   ├── index.js                 # Application entry point
│   ├── bot.js                   # WhatsApp client & message handler
│   ├── config.js                # Configuration settings
│   ├── logic.js                 # Business logic for task tracking
│   ├── scheduler.js             # Cron job for automated reminders
│   ├── storage.js               # File-based data persistence
│   └── populateMentees.js       # Utility to auto-populate mentees
│
├── 📁 data/                     # Data storage directory
│   ├── mentees.json             # Mentee database (names, WhatsApp IDs, progress)
│   ├── chatbox_logs.json        # Activity logs (all events)
│   └── actual_mentees.json      # Backup/reference mentees
│
├── 📁 session/                  # WhatsApp Web session storage
│   └── [auto-generated files]   # Authentication tokens & session data
│
├── 📁 node_modules/             # Installed npm packages
├── 📁 .vscode/                  # VS Code settings
├── 📁 .wwebjs_cache/            # WhatsApp Web cache
└── 📁 .git/                     # Git repository

```

---

## 🔧 Core Files & Their Functions

### **1. src/index.js** - Entry Point
- Initializes the WhatsApp bot
- Sets up the reminder scheduler
- Starts the application
- **Run with:** `node src/index.js`

### **2. src/bot.js** - WhatsApp Client & Message Handler
- Connects to WhatsApp Web API
- Monitors group messages in real-time
- Detects task completion keywords
- Captures sender information and timestamp
- Calls logic handler to record completion
- **Dependencies:** whatsapp-web.js, qrcode-terminal
- **Uses:** config.js, logic.js

### **3. src/config.js** - Configuration
- **GROUP_NAME:** Target WhatsApp group to monitor ("TestingGroup")
- **DONE_KEYWORDS:** Task completion keywords ['prayer', 'study', 'quiet time']
- **LATE_THRESHOLD_DAYS:** Days before marking someone as late (default: 2)
- **REMINDER_MESSAGE_TEMPLATE:** Message template for late reminders
- **Edit this to:** Change group name, keywords, threshold, or reminder message

### **4. src/logic.js** - Business Logic
**Functions:**
- `recordDone(whatsappId, timestampIso)` - Records task completion
  - Finds mentee by WhatsApp ID
  - Updates last_done_at timestamp
  - Creates new mentee if not found
  - Logs the event
  
- `getLatePeople(now, thresholdDays)` - Identifies late mentees
  - Checks who hasn't completed tasks recently
  - Returns list of mentees exceeding threshold
  - Used by scheduler for reminders

**Uses:** storage.js, config.js

### **5. src/scheduler.js** - Automated Reminders
- **Cron Schedule:** Daily at 20:00 (8 PM server time)
- Runs job to find late mentees
- Sends personalized WhatsApp reminder messages
- Logs reminder events
- **Uses:** logic.js, config.js, storage.js

### **6. src/storage.js** - Data Persistence
**Functions:**
- `loadMentees()` - Reads mentees.json
- `saveMentees(mentees)` - Writes mentees to disk
- `appendLog(entry)` - Appends log entry to chatbox_logs.json

**Data Format:**
```javascript
// mentees.json
{
  "mentee_1": {
    "name": "John Doe",
    "whatsapp_id": "263772345678",
    "last_done_at": "2026-02-28T09:31:52.000Z"
  }
}

// chatbox_logs.json
{
  "log_1234567890_abc123": {
    "whatsapp_id": "263772345678",
    "message": "John Doe Completed the Task on 2026-02-28T09:31:52.000Z",
    "timestamp": "2026-02-28T09:31:52.000Z",
    "type": "DONE"
  }
}
```

### **7. src/populateMentees.js** - Auto-Population Utility
- **One-time use script** to extract mentees from WhatsApp group
- Connects to WhatsApp group
- Extracts all members and their contact info
- Auto-generates mentees.json
- **Run with:** `node src/populateMentees.js`
- **No manual copying needed!**

---

## 📊 Data Files

### **data/mentees.json**
- Database of all mentees
- Fields: name, whatsapp_id, last_done_at
- Auto-updated when tasks are completed
- Can be pre-populated via populateMentees.js

### **data/chatbox_logs.json**
- Complete activity history
- Tracks all events: DONE (task completion), LATE (reminders sent)
- Useful for analytics and debugging
- Grows over time (archive periodically if needed)

### **data/actual_mentees.json**
- Backup reference file
- Keep for reference/comparison

---

## 🔄 Application Flow

```
1. START
   └─> index.js
        ├─> Initializes WhatsApp Bot
        │   └─> bot.js connects to WhatsApp Web
        │       └─> QR code displayed for first login
        │
        └─> Sets up Scheduler
            └─> scheduler.js configures cron job (8 PM daily)

2. REAL-TIME MESSAGE MONITORING
   └─> bot.js listens for group messages
        ├─> Filters: only "TestingGroup"
        ├─> Filters: only messages with keywords
        └─> Calls recordDone() in logic.js
            └─> Updates mentees.json
            └─> Appends to chatbox_logs.json

3. SCHEDULED REMINDERS (Daily 8 PM)
   └─> scheduler.js triggers cron job
        ├─> Calls getLatePeople() in logic.js
        ├─> Identifies mentees past threshold
        └─> Sends WhatsApp reminder message
            └─> Logs reminder event
```

---

## 🚀 How to Run

### **First Time Setup:**
```powershell
# Install dependencies
npm install

# Populate mentees from group (one-time)
node src/populateMentees.js

# Start the bot
node src/index.js
```

### **Daily Runs:**
```powershell
# Just run the bot (uses saved WhatsApp session)
node src/index.js
```

### **Using Docker:**
```bash
docker build -t whatsapp-bot .
docker run -d whatsapp-bot
```

---

## 🔐 Authentication

- **First Run:** WhatsApp Web login required via QR code
- **Session Storage:** Saved in `./session/` folder
- **Subsequent Runs:** No QR code needed (uses saved session)
- **Reset Auth:** Delete `./session/` folder to force re-login

---

## ⚙️ Configuration Guide

Edit `src/config.js` to customize:

```javascript
module.exports = {
    GROUP_NAME: "TestingGroup",              // Change to your group name
    DONE_KEYWORDS: ['prayer', 'study', 'quiet time'],  // Add/remove keywords
    LATE_THRESHOLD_DAYS: 2,                 // Days before marking late
    REMINDER_MESSAGE_TEMPLATE: (name) => 
        `Hi ${name}, please remember...`    // Customize reminder message
};
```

---

## 📦 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| whatsapp-web.js | * | WhatsApp Web client API |
| qrcode-terminal | * | QR code display for authentication |
| node-cron | * | Schedule automated reminder jobs |

---

## 🐛 Known Issues & Fixes

All major bugs have been fixed:
- ✅ Typo in message property (msg.authr → msg.author)
- ✅ Undefined function (lenght → Object.keys.length)
- ✅ Null typo (nul → null)
- ✅ JSON parsing error (stringify → parse)
- ✅ Group detection (msg.isGroup → chat.isGroup)
- ✅ Log structure (array → object with unique IDs)

See `ERROR_REPORT.md` for detailed error documentation.

---

## 💡 Usage Tips

1. **Test First:** Use "TestingGroup" before moving to production
2. **Monitor Logs:** Check `chatbox_logs.json` for activity history
3. **Keywords:** Keep keywords simple and distinctive
4. **Timezone:** Scheduler runs on server timezone (change if needed)
5. **Backups:** Regularly backup `data/` folder

---

## 🔮 Future Enhancements

- [ ] Web dashboard to view mentee progress
- [ ] Email notifications in addition to WhatsApp
- [ ] Customizable reminder frequency
- [ ] Analytics and progress reports
- [ ] Database instead of JSON files
- [ ] Multiple group support
- [ ] Admin commands via WhatsApp

---

## 📝 Author Notes

- Created for automated mentorship tracking
- Reduces manual tracking burden
- Ensures consistent follow-up on task completion
- 24/7 monitoring capability with Docker

---

**Last Updated:** March 3, 2026  
**Version:** 1.0.0
