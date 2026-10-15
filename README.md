<div align="center">

# 💬 Discord Message Exporter

**Export your Discord conversations. Keep them organized. Browse them anytime.**

A Chromium browser extension for exporting accessible Discord messages into searchable HTML archives and plain-text transcripts, with media support.

<br>

<a href="#features">Explore Features</a>
&nbsp; · &nbsp;
<a href="#installation">Installation</a>
&nbsp; · &nbsp;
<a href="#how-to-use">How to Use</a>

<br><br>

<img src="https://img.shields.io/badge/Chrome-Extension-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Extension">
<img src="https://img.shields.io/badge/Manifest-V3-34A853?style=flat-square" alt="Manifest V3">
<img src="https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript">

</div>

---

## What is Discord Message Exporter?

Discord conversations can contain messages, attachments, replies, and other details that are difficult to revisit by scrolling through the app.

**Discord Message Exporter** lets you export accessible message history and save it as an archive on your computer.

Choose the conversations you want, apply filters, and export the results. The generated archive includes HTML pages for browsing and plain-text transcripts for simpler access.

## <a id="features"></a>Features

| Feature | What it does |
|---|---|
| 💬 Message Export | Export accessible direct messages and supported server conversations |
| 🔎 User Scanning | Search for conversations associated with a target user |
| 🗂️ Channel Selection | Choose which available servers and channels to include |
| 🌐 HTML Viewer | Browse exported messages through generated HTML pages |
| 📝 Text Transcripts | Save conversations as `.txt` files |
| 📎 Media Downloads | Download supported message attachments into the archive |
| 🔍 Message Search | Search within exported channel pages |
| ↩️ Reply Context | Preserve supported reply information |
| 🧵 Thread Support | Include supported thread conversations |
| 🎛️ Export Filters | Filter messages by date, content, length, and other criteria |
| 📊 Progress Tracking | Monitor export progress and activity logs |
| 🔄 Export Controls | Pause, resume, cancel, and retry supported operations |

Additional options include incremental exports, media galleries, avatar downloads, reaction details, link previews, and nested reply layouts.

The information available in an export depends on Discord access, the selected settings, and the data available when the export runs.

---

## How it works

<div align="center">

```text
       Open the extension
               |
               v
        Enter user details
               |
               v
        Scan conversations
               |
               v
      Select channels and DMs
               |
               v
         Set export filters
               |
               v
        Start the export
               |
               v
       Save the ZIP archive
               |
               v
       Browse your messages
```

</div>

The extension processes the selected conversations, builds the transcript files, collects supported attachments, and packages the results into a ZIP archive.

## Installation

This project can be loaded as an unpacked Chrome or compatible Chromium extension.

### 1. Download the repository

Clone the project:

```bash
git clone https://github.com/Hidden-Rhythm/Discord-msg-exporter.git
cd Discord-msg-exporter
```

Or use **Code → Download ZIP** on GitHub and extract the archive.

### 2. Open the extensions page

In Chrome, visit:

```text
chrome://extensions/
```

### 3. Enable Developer mode

Turn on **Developer mode** on the extensions page.

### 4. Load the extension

Click **Load unpacked** and select the project directory containing `manifest.json`.

### 5. Open the extension

Pin the extension if you want quick access, then open its popup to access the exporter controls.

---

## <a id="how-to-use"></a>How to Use

### Step 1 — Open the popup

Click the Discord Message Exporter icon in your browser's toolbar.

### Step 2 — Enter the required details

Follow the fields shown in the extension to provide the required Discord account information and target user ID.

**Security note:** A Discord user token is highly sensitive. Never share it, post it in screenshots, or commit it to GitHub. Only use account access you own or are explicitly authorized to use. Review how the extension handles and stores credentials before entering them.

### Step 3 — Scan for conversations

Use the scan control to find accessible conversations associated with the target user.

Wait for the scan to finish and check the results before continuing.

### Step 4 — Choose what to export

Select the direct messages, servers, channels, or supported threads you want included.

You don't have to export everything at once. Starting with one conversation is a good way to test the output.

### Step 5 — Configure the options

Depending on your needs, you can adjust:

- Date ranges
- Keyword or regular-expression filters
- Minimum message length
- Included and excluded channels
- Attachment-only or replies-only filtering
- Available media, avatar, thread, and reply options

### Step 6 — Start and monitor the export

Start the export and follow the progress information in the popup.

Use the available pause, resume, cancel, or retry controls when needed.

### Step 7 — Open your archive

Once the export finishes, open the downloaded ZIP file and extract it.

Open the generated `index.html` to browse the archive. Individual channel pages and text transcripts are available where generated.

---

## Inside the exported archive

A typical export may look like this:

```text
discord-export/
│
├── index.html
│
├── channels/
│   ├── general.html
│   ├── general.txt
│   ├── random.html
│   └── random.txt
│
└── _assets/
    └── media/
        ├── image.png
        ├── video.mp4
        └── audio.mp3
```

*This is an example layout. Actual filenames and folders depend on the exported conversations and available media.*

### HTML viewer

Use the HTML pages to navigate the saved conversations, search messages, inspect supported reply context, and view available attachments.

### Plain-text transcripts

The `.txt` files provide a simpler, lightweight version of the exported conversation.

### Media files

Supported attachments can be saved under `_assets/media/` so they can be accessed alongside the exported archive.

---

## Export options

| Option | Purpose |
|---|---|
| Date range | Limit the export to a particular period |
| Keyword / Regex | Match messages against text or a regular expression |
| Minimum length | Exclude messages shorter than the specified length |
| Channel whitelist | Include channels matching a pattern |
| Channel blacklist | Exclude channels matching a pattern |
| Attachments only | Keep messages containing attachments |
| Replies only | Keep replies |
| Incremental export | Reuse saved checkpoints where supported |
| Include threads | Collect supported thread content |
| Download avatars | Include available avatars and server icons |
| Reaction details | Collect supported reaction-user information |
| Link previews | Enrich supported links with preview information |
| Media gallery | Generate a gallery for supported media |
| Nested replies | Display supported reply context in a nested layout |

Available settings may vary with the extension version and the data Discord makes accessible.

---

## Project structure

```text
Discord-msg-exporter/
│
├── manifest.json      # Extension configuration
├── popup.html         # Popup interface
├── popup.js           # Popup controls and interactions
├── background.js      # Background service worker
├── offscreen.html     # Offscreen document
├── offscreen.js       # Export processing and HTML generation
└── jszip.min.js       # ZIP archive generation
```

## Built with

<div align="center">

<img src="https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript">
<img src="https://img.shields.io/badge/HTML5-Viewer-E34F26?style=flat-square&logo=html5&logoColor=white" alt="HTML5">
<img src="https://img.shields.io/badge/CSS3-Interface-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS3">
<img src="https://img.shields.io/badge/Chrome-Extensions-4285F4?style=flat-square&logo=googlechrome&logoColor=white" alt="Chrome Extensions">

</div>

| Technology | Purpose |
|---|---|
| JavaScript | Export logic and interface interactions |
| Chrome Extensions API | Browser integration and downloads |
| Manifest V3 | Extension architecture |
| HTML & CSS | Popup interface and transcript viewer |
| JSZip | Creating downloadable ZIP archives |

---

## Notes

- Exports are limited to messages and media the extension can access and process.
- Large exports may take longer and use additional storage.
- Discord may change its web application or internal endpoints, which can affect compatibility.
- Review the source code and permissions before installing the extension.
- Keep exported archives and account credentials private, especially when they contain personal conversations or attachments.

---

<div align="center">

### Made with ☕ and JavaScript

**Built by Hidden Rhythm**

<sub>Keeping conversations accessible, one export at a time.</sub>

<br>

<a href="https://github.com/Hidden-Rhythm/Discord-msg-exporter">GitHub Repository</a>

</div>
