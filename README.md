 <div align="center">

# 💬 Discord Message Exporter

### Your Discord memories deserve a home. ✨

**Scan. Export. Relive.**

A powerful Chromium extension that turns Discord message history into beautiful, searchable HTML archives — complete with transcripts, media, replies, and more.

<br>

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://github.com/Hidden-Rhythm/Discord-msg-exporter)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-34A853?style=for-the-badge)](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
[![JavaScript](https://img.shields.io/badge/JavaScript-Powered-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)

<br>

### 💭 Don't let your conversations disappear into the scroll.

[ **Explore Features** ](#-features) · [ **Installation** ](#-installation) · [ **How to Use** ](#-how-to-use)

</div>

---

## 🌌 What's this all about?

Ever wanted to keep a conversation without endlessly scrolling through Discord?

**Discord Message Exporter** helps you preserve accessible Discord message history in a format you can actually browse, search, and keep.

Scan for a user, select the conversations you want, customize your filters, and export everything into a downloadable ZIP archive.

No more endless scrolling. No more hunting for that one message from months ago. Just your conversations, organized your way. 💜

## ✨ Features that hit different

<table>
<tr>
<td width="50%" valign="top">

### 💬 Message Magic

- Export accessible direct messages
- Scan servers for a target user
- Select specific servers and channels
- Support multiple target user IDs
- Collect supported thread conversations
- Preserve supported reply context

</td>
<td width="50%" valign="top">

### 🎨 Beautiful Archives

- Standalone HTML transcript viewer
- Plain-text `.txt` transcripts
- Search messages inside channels
- Organized channel navigation
- Message timestamps and author details
- Nested reply presentation

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🖼️ Media Matters

- Download message attachments
- View images in exported archives
- Play supported audio and video files
- Preserve supported embedded previews
- Optionally include avatars and server icons
- Detect duplicate media downloads

</td>
<td width="50%" valign="top">

### 🎛️ You're in Control

- Date-range filtering
- Keyword and regex filtering
- Minimum message length
- Channel include/exclude patterns
- Attachments-only and replies-only filters
- Pause, resume, cancel, and retry controls

</td>
</tr>
</table>

### ⚡ And there's more...

- 📦 Downloadable ZIP archives
- 🔄 Incremental exports using saved checkpoints
- 🧵 Thread collection options
- 😀 Optional reaction-user details
- 🔗 Optional link-preview enrichment
- 🖼️ Optional media gallery
- 📊 Export progress and activity logs
- 🧹 Cache controls and failed-download retry support

*Some details depend on Discord access, available message data, and the options you enable.*

---

## 🪄 How the magic works

<div align="center">

```text
       💬 YOUR DISCORD HISTORY
                  │
                  ▼
       🔎 Scan for a user
                  │
                  ▼
       🗂️ Choose conversations
                  │
                  ▼
       🎛️ Customize your filters
                  │
                  ▼
       ⚡ Export messages & media
                  │
                  ▼
       📦 Download your archive
                  │
                  ▼
       ✨ Browse it whenever you want
```

</div>

Simple workflow. Organized output. Conversations preserved.

## 📦 What's inside the archive?

Your export includes browsable HTML pages and plain-text transcripts, with downloaded media where available.

A typical archive is organized like this:

```text
📦 discord-export/
│
├── 📄 index.html
│
├── 📂 channels/
│   ├── 💬 general.html
│   ├── 📝 general.txt
│   ├── 💬 random.html
│   └── 📝 random.txt
│
└── 📂 _assets/
    └── 📂 media/
        ├── 🖼️ image.png
        ├── 🎬 video.mp4
        └── 🎵 audio.mp3
```

*Illustrative structure — actual filenames and folders depend on the export.*

Open the HTML archive to browse saved conversations, search channel messages, and access downloaded attachments. Prefer something lightweight? The plain-text transcripts have you covered.

---

## 🎛️ Customize your export

Not every conversation needs to come along for the ride.

### 🎯 Filters

| Filter | What it does |
|---|---|
| 📅 Date range | Narrow the export to a selected period |
| 🔎 Keyword / regex | Match message content against a pattern |
| 📏 Minimum length | Skip messages below a chosen character count |
| ✅ Channel whitelist | Include channels matching a pattern |
| 🚫 Channel blacklist | Exclude channels matching a pattern |
| 📎 Attachments only | Keep messages containing attachments |
| ↩️ Replies only | Keep replies |

### 🧪 Advanced options

| Option | Purpose |
|---|---|
| 🔄 Incremental export | Reuse saved checkpoints to avoid re-exporting previously covered messages |
| 🧵 Include threads | Collect supported thread content |
| 🖼️ Download avatars | Include available user avatars and server icons |
| 😀 Reaction details | Retrieve reaction-user information where available |
| 🔗 Link previews | Enrich supported URLs with preview metadata |
| 🖼️ Media gallery | Add a gallery to channel pages |
| 💬 Nested replies | Display supported reply context in a threaded layout |

You can also monitor progress, pause or resume a running export, cancel it, retry failed downloads, and clear the incremental cache.

---

## 🚀 Installation

Ready to give your conversations a little backup plan? Let's go. ✨

### 1️⃣ Download the project

Clone the repository:

```bash
git clone https://github.com/Hidden-Rhythm/Discord-msg-exporter.git
cd Discord-msg-exporter
```

Alternatively, click **Code → Download ZIP** on GitHub and extract the downloaded folder.

### 2️⃣ Open Chrome Extensions

Navigate to:

```text
chrome://extensions/
```

Using another Chromium-based browser? Open its extensions management page instead.

### 3️⃣ Enable Developer mode

Switch on **Developer mode** in the extensions page.

### 4️⃣ Load the extension

Click **Load unpacked** and select the project folder containing `manifest.json`.

### 5️⃣ You're in! 🎉

Pin the extension if you like, click its icon, and explore the exporter interface.

> **Note:** This project uses Chrome's Manifest V3 extension architecture. Browser support depends on compatibility with the APIs it uses.

---

## 🕹️ How to use

1. **Open** the extension popup.
2. **Enter your Discord user token** for an account you own or are authorized to use.
3. **Enter the target user's Discord ID.**
4. **Scan** for accessible conversations.
5. **Select** the relevant DMs, servers, or channels.
6. **Customize** your filters and advanced settings.
7. **Export** your selection and watch the progress log.
8. **Open** the resulting archive and browse your saved conversations.

### 💡 Pro tip

Try a small export first. One channel and a short date range make it easier to check the output before starting a much larger export.

---

## 🧰 Built with

<div align="center">

![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-Viewer-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-Interface-1572B6?style=flat-square&logo=css3&logoColor=white)
![Chrome](https://img.shields.io/badge/Chrome-Extensions-4285F4?style=flat-square&logo=googlechrome&logoColor=white)

</div>

| Technology | Role |
|---|---|
| JavaScript | Message processing and extension logic |
| Chrome Extensions API | Browser integration and downloads |
| Manifest V3 | Extension architecture |
| Discord API endpoints | Retrieve accessible Discord data |
| JSZip | Generate ZIP archives |
| HTML & CSS | Build the standalone transcript viewer |

### 📁 Project structure

```text
Discord-msg-exporter/
├── manifest.json     # Extension configuration
├── popup.html        # Popup interface
├── popup.js          # Popup interactions
├── background.js     # Background service worker
├── offscreen.html    # Offscreen document
├── offscreen.js      # Export engine and HTML generation
├── jszip.min.js      # ZIP archive library
└── README.md         # You are here!
```

---

## 🔐 Privacy isn't optional

This extension can process private conversations and uses a Discord user token. Please take security seriously.

- 🔑 **Protect your token.** It acts as an authentication secret. Never share it or commit it to GitHub.
- 💾 **Know where it is stored.** The current implementation saves the token in Chrome extension local storage.
- 📁 **Protect your exports.** Archives may contain private messages, usernames, IDs, attachments, and other personal information.
- 👀 **Review the code.** Understand the permissions and network requests before installing the extension.
- 🧹 **Clean up when needed.** Remove stored credentials and sensitive archives when you no longer need them.
- ⚖️ **Use responsibly.** Only access and export data you're authorized to handle, and follow applicable laws and Discord's Terms of Service.

The extension communicates with Discord and its media CDNs. If link-preview retrieval is enabled, it may also contact URLs found in messages.

**Important:** This is an unofficial project and is not affiliated with or endorsed by Discord.

---

## ⚠️ A few things to know

- Exports depend on your account's access and available message history.
- Discord API changes, permissions, and rate limits can affect results.
- Some attachments, reactions, or message context may be unavailable.
- Large exports may take time and consume significant storage.
- Incremental exports use locally stored checkpoint data.

---

## 💜 Made by Hidden-Rhythm

<div align="center">

### Built with curiosity. Designed for convenience.

If this project is useful to you, consider giving it a ⭐ on GitHub!

<a href="https://github.com/Hidden-Rhythm/Discord-msg-exporter">
  <img src="https://img.shields.io/badge/⭐%20Star%20this%20project-Show%20some%20love-8B5CF6?style=for-the-badge" alt="Star this project">
</a>

<br><br>

[**GitHub Profile →**](https://github.com/Hidden-Rhythm)

<br>

<sub>💬 Conversations fade. Memories don't have to.</sub>

</div>
