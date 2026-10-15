 <div align="center">

# 💬 Discord Message Exporter

### *Your Discord conversations, saved beyond the scroll. ✨*

<br>

<a href="https://github.com/Hidden-Rhythm/Discord-msg-exporter">
  <img src="https://img.shields.io/badge/💻%20Source-GitHub-black?style=for-the-badge&logo=github" alt="GitHub Source">
</a>
&nbsp;
<img src="https://img.shields.io/badge/🌐%20Browser-Chromium-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chromium Extension">
&nbsp;
<img src="https://img.shields.io/badge/Manifest-V3-34A853?style=for-the-badge" alt="Manifest V3">

<br><br>

**Scan. Select. Export. Keep your conversations. 💜**

</div>

---

## 💬 What Is This?

**Discord Message Exporter** is a Chromium browser extension built with **JavaScript, HTML, and CSS** that helps you export accessible Discord message history into organized archives.

Instead of scrolling through old conversations to find that one message, you can export selected conversations and browse them later through generated HTML pages or plain-text transcripts.

The extension can collect supported message content, replies, attachments, and additional conversation details depending on the available data and selected options.

Your conversations, your selection, your archive. ✨

---

## ✨ Features

| Feature | Description |
|---|---|
| 💬 Message Export | Export accessible direct messages and supported server conversations |
| 🔎 User Scanning | Scan for conversations associated with a target user |
| 🗂️ Channel Selection | Choose specific servers and channels to export |
| 🌐 HTML Viewer | Browse exported conversations through generated HTML pages |
| 📝 Text Transcripts | Save messages as lightweight `.txt` files |
| 📎 Media Downloads | Download supported attachments into the archive |
| 🔍 Message Search | Search through messages inside exported channel pages |
| ↩️ Reply Context | Preserve supported reply information |
| 🧵 Thread Support | Include supported thread conversations |
| 🎛️ Advanced Filters | Filter by dates, keywords, message length, and channels |
| 📊 Progress Tracking | Monitor export progress and activity logs |
| ⏸️ Export Controls | Pause, resume, cancel, and retry supported operations |
| 🖼️ Media Gallery | Generate a gallery for supported media |
| 🔄 Incremental Export | Reuse saved checkpoints where supported |
| 😀 Reaction Details | Collect supported reaction-user information |
| 🔗 Link Previews | Enrich supported links with preview information |

---

## 🧭 How It Works

```text
              ┌────────────────────────┐
              │   Open Extension 💬    │
              └────────────┬───────────┘
                           │
              ┌────────────▼───────────┐
              │   Enter Required Info  │
              │                        │
              │   Account Credentials  │
              │   Target User ID       │
              └────────────┬───────────┘
                           │
              ┌────────────▼───────────┐
              │   Scan Conversations   │
              │                        │
              │   Direct Messages      │
              │   Servers & Channels   │
              └────────────┬───────────┘
                           │
              ┌────────────▼───────────┐
              │   Select & Customize   │
              │                        │
              │   Filters              │
              │   Media Options        │
              │   Export Settings      │
              └────────────┬───────────┘
                           │
                         EXPORT
                           │
              ┌────────────▼───────────┐
              │    Build Archive 📦    │
              │                        │
              │    HTML + TXT          │
              │    Supported Media     │
              └────────────┬───────────┘
                           │
              ┌────────────▼───────────┐
              │   Browse Your History  │
              │          ✨            │
              └────────────────────────┘
```

---

## 📦 Inside the Export

Each export is packaged into a downloadable ZIP archive containing the generated transcript files and supported media.

A typical archive may look like this:

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

*This is an illustrative structure. Actual filenames and folders depend on the exported content.*

### 🌐 HTML Viewer

Open the generated HTML pages to browse saved conversations, navigate channels, search messages, and view supported reply context.

### 📝 Plain-Text Transcripts

Prefer something lightweight? The `.txt` transcripts provide a simple, readable version of the exported messages.

### 🖼️ Media & Attachments

Supported images, audio, video, and other attachments can be downloaded into the archive so they can be accessed alongside the conversations.

---

## 🎛️ Customize Your Export

Not every conversation needs to come along for the ride.

### 🔍 Available Filters

| Filter | Purpose |
|---|---|
| 📅 Date Range | Export messages from a selected period |
| 🔎 Keyword / Regex | Match messages against text or a regular expression |
| 📏 Minimum Length | Exclude messages below a chosen character count |
| ✅ Channel Whitelist | Include channels matching a pattern |
| 🚫 Channel Blacklist | Exclude channels matching a pattern |
| 📎 Attachments Only | Keep messages containing attachments |
| ↩️ Replies Only | Keep replies |

### ⚙️ Advanced Options

| Option | Purpose |
|---|---|
| 🔄 Incremental Export | Reuse saved export checkpoints where supported |
| 🧵 Include Threads | Collect supported thread content |
| 🖼️ Download Avatars | Include available avatars and server icons |
| 😀 Reaction Details | Retrieve supported reaction-user information |
| 🔗 Link Previews | Add supported link-preview information |
| 🖼️ Media Gallery | Generate a gallery for supported media |
| 💬 Nested Replies | Display supported reply context in a nested layout |

The extension also includes progress reporting, pause/resume controls, cancellation, failed-download retries, and incremental-cache management.

---

## 🚀 Installation

### 1. Download the Repository

Clone the project:

```bash
git clone https://github.com/Hidden-Rhythm/Discord-msg-exporter.git
cd Discord-msg-exporter
```

Or download the repository as a ZIP and extract it.

### 2. Open Chrome Extensions

Navigate to:

```text
chrome://extensions/
```

### 3. Enable Developer Mode

Turn on **Developer mode** in the extensions manager.

### 4. Load the Extension

Click:

```text
Load unpacked
```

Select the extracted project directory containing `manifest.json`.

### 5. Open the Extension

Pin the extension to your toolbar if you want quick access, then click its icon to open the popup.

That's it. The extension is ready to configure. 🎉

---

## 🕹️ How to Use

### Step 1 — Open the Popup

Click the Discord Message Exporter icon in your browser toolbar.

### Step 2 — Enter the Required Details

Follow the popup fields to provide the required account information and target user's Discord ID.

> ⚠️ **Keep your credentials private.** Discord user tokens are sensitive authentication credentials. Never share them, post them in screenshots, or commit them to GitHub. Review the extension's credential handling before entering a token, and only access accounts you own or are authorized to use.

### Step 3 — Scan for Conversations

Use the scan control to discover accessible conversations associated with the target user.

Wait for the scan to complete, then review the results.

### Step 4 — Select What You Need

Choose the relevant DMs, servers, channels, or supported threads.

You can narrow the export using the available filters and advanced options.

### Step 5 — Start the Export

Start the export and monitor the progress information. Use the available pause, resume, cancel, and retry controls when necessary.

### Step 6 — Open Your Archive

Once the ZIP archive has been downloaded:

1. Extract the ZIP file.
2. Locate the generated `index.html`, if present.
3. Open it in your browser.
4. Browse the saved conversations and supported media.

**💡 Pro tip:** Start with one channel and a short date range. It's an easy way to check the output before exporting a much larger conversation history.

---

## 🗂️ Project Structure

```text
Discord-msg-exporter/
│
├── manifest.json
├── popup.html
├── popup.js
├── background.js
├── offscreen.html
├── offscreen.js
└── jszip.min.js
```

| File | Description |
|---|---|
| `manifest.json` | Extension configuration, permissions, and browser integration |
| `popup.html` | Popup interface |
| `popup.js` | Popup controls and interactions |
| `background.js` | Background service worker |
| `offscreen.html` | Offscreen document |
| `offscreen.js` | Export processing, transcript generation, and media handling |
| `jszip.min.js` | ZIP archive generation |

---

## 🛠️ Built With

| Technology | Purpose |
|---|---|
| JavaScript | Extension logic and export processing |
| HTML5 | Popup layout and transcript pages |
| CSS3 | Interface styling |
| Chrome Extensions API | Browser integration and downloads |
| Manifest V3 | Extension architecture |
| JSZip | Packaging exported files into ZIP archives |

**No separate backend server is required by the extension's core architecture.** It relies on browser-side code and Discord's accessible web-client data.

---

## 🔐 Privacy & Important Notes

- Exported conversations and attachments may contain personal information.
- Keep your downloaded archives private and secure.
- Never expose authentication tokens or commit them to your repository.
- Review the extension's permissions and source code before installing it.
- Export only data you are authorized to access.
- Discord can change its web application and internal endpoints, which may affect compatibility.
- Not every message, attachment, reaction, or thread is guaranteed to be available.

---

## 🌐 Project Links

<div align="center">

<a href="https://github.com/Hidden-Rhythm/Discord-msg-exporter">
  <img src="https://img.shields.io/badge/Explore%20the%20Code-GitHub-181717?style=for-the-badge&logo=github&logoColor=white" alt="Explore Source Code">
</a>

</div>

---

<div align="center">

### Made with JavaScript, curiosity & a little bit of purple. 💜

**Hidden-Rhythm**

<sub>Keep the messages. Skip the endless scrolling.</sub>

</div>
