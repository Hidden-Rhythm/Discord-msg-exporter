 <div align="center">

# Discord Message Exporter

### Your Discord history. Outside the scroll.

A Chromium extension for exporting accessible Discord conversations into searchable HTML archives and plain-text transcripts, with support for attachments, replies, and channel-level browsing.

<br>

<a href="https://github.com/Hidden-Rhythm/Discord-msg-exporter">
  <img src="https://img.shields.io/badge/VIEW%20SOURCE-GITHUB-181717?style=for-the-badge&logo=github&logoColor=white" alt="View Source">
</a>
<img src="https://img.shields.io/badge/CHROMIUM-MANIFEST%20V3-5865F2?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chromium Extension">
<img src="https://img.shields.io/badge/BUILT%20WITH-JAVASCRIPT-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">

<br><br>

[Features](#features) &nbsp; · &nbsp; [Installation](#installation) &nbsp; · &nbsp; [Usage](#usage) &nbsp; · &nbsp; [Privacy](#privacy)

</div>

---

## Overview

Discord is built around conversations that keep moving. Finding an old message, revisiting an attachment, or keeping a readable copy of a conversation isn't always convenient.

**Discord Message Exporter** brings accessible message history into a local archive you can keep and browse separately.

Select conversations, configure your export, and generate an archive containing HTML transcripts, text files, and supported media.

No complicated setup. Just an extension, your selected conversations, and an archive you can revisit.

## Features

<table>
<tr>
<td width="50%" valign="top">

### Message Collection

- Accessible direct-message history
- Server and channel selection
- Target-user scanning
- Supported thread collection
- Reply context preservation

</td>
<td width="50%" valign="top">

### Archive Viewer

- Standalone HTML transcript pages
- Plain-text message transcripts
- Channel navigation
- Search within exported messages
- Supported nested reply layouts

</td>
</tr>
<tr>
<td width="50%" valign="top">

### Media & Attachments

- Supported attachment downloads
- Local media assets
- Optional avatar and server-icon downloads
- Supported image, audio, and video viewing
- Optional media gallery

</td>
<td width="50%" valign="top">

### Export Controls

- Date and content filters
- Channel include/exclude patterns
- Attachment-only and replies-only filters
- Incremental export checkpoints
- Progress, pause, resume, and cancellation controls

</td>
</tr>
</table>

Additional options include reaction details, link-preview enrichment, retrying failed downloads, and clearing the incremental cache.

*Results depend on accessible Discord data, supported content types, and the options enabled.*

## How it works

<div align="center">

```text
┌──────────────────────────────────────┐
│            DISCORD WEB               │
│        Accessible message data       │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│             DISCOVERY                │
│       Scan and select conversations  │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│              EXPORT                  │
│      Filters · Messages · Media      │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│              ARCHIVE                 │
│          HTML · TXT · ZIP            │
└──────────────────────────────────────┘
```

</div>

The extension processes the selected message data, generates transcript pages, collects supported attachments, and packages the output into a ZIP archive.

## Installation

### Requirements

- Google Chrome or a compatible Chromium-based browser
- The project files from this repository

### 01 — Get the source

```bash
git clone https://github.com/Hidden-Rhythm/Discord-msg-exporter.git
cd Discord-msg-exporter
```

Alternatively, download the repository using **Code → Download ZIP** and extract it.

### 02 — Open the extensions manager

Navigate to:

```text
chrome://extensions/
```

### 03 — Enable Developer mode

Enable **Developer mode** in the extensions manager.

### 04 — Load the extension

Click **Load unpacked** and select the extracted project folder containing `manifest.json`.

### 05 — Open the popup

Pin the extension to your toolbar if desired, then click its icon to open the exporter interface.

## Usage

### 01. Configure the export

Open the extension popup and follow the available fields to provide the required account information and target user ID.

**Credential warning:** Discord user tokens are sensitive authentication credentials. Never share them or commit them to a repository. Review the source code's credential handling before entering a token, and only access accounts you own or are authorized to use.

### 02. Discover conversations

Use the scan control to discover accessible conversations associated with the target user. Review the returned results before selecting what to export.

### 03. Select your content

Choose the relevant direct messages, servers, channels, or supported threads. Use the available filters to narrow the export by date, content, message length, or channel.

### 04. Run the export

Start the export and monitor the available progress information. Use the provided controls to pause, resume, cancel, or retry operations where supported.

### 05. Browse the result

Extract the downloaded ZIP archive and open the generated `index.html` when present. Browse the channel pages, search supported message content, and access downloaded media.

**Recommended:** Start with one channel and a short date range before attempting a large export.

## The archive

A typical export may contain a structure similar to this:

```text
discord-export/
│
├── index.html
│
├── channels/
│   ├── general.html
│   ├── general.txt
│   └── random.html
│
└── _assets/
    └── media/
        ├── image.png
        └── attachment.mp4
```

*Illustrative structure only. Filenames and generated files vary by export.*

| Output | Description |
|---|---|
| `index.html` | Entry point for the generated archive, when included |
| `.html` | Browsable transcript pages |
| `.txt` | Plain-text transcripts |
| `_assets/media/` | Downloaded attachments, when available |

## Project structure

```text
Discord-msg-exporter/
├── manifest.json
├── popup.html
├── popup.js
├── background.js
├── offscreen.html
├── offscreen.js
└── jszip.min.js
```

| File | Responsibility |
|---|---|
| `manifest.json` | Extension configuration and permissions |
| `popup.html` | Popup layout |
| `popup.js` | Popup interactions and controls |
| `background.js` | Background service worker |
| `offscreen.html` | Offscreen document |
| `offscreen.js` | Export processing and HTML generation |
| `jszip.min.js` | ZIP archive generation |

## Technology

<div align="center">

<img src="https://img.shields.io/badge/JavaScript-ES6%2B-F7DF1E?style=flat-square&logo=javascript&logoColor=black" alt="JavaScript">
<img src="https://img.shields.io/badge/HTML5-Structure-E34F26?style=flat-square&logo=html5&logoColor=white" alt="HTML5">
<img src="https://img.shields.io/badge/CSS3-Interface-1572B6?style=flat-square&logo=css3&logoColor=white" alt="CSS3">
<img src="https://img.shields.io/badge/JSZip-Archive-6E56CF?style=flat-square" alt="JSZip">

</div>

- **JavaScript** — export logic and extension interactions
- **Chrome Extensions API** — browser integration and downloads
- **Manifest V3** — extension architecture
- **HTML & CSS** — popup and transcript presentation
- **JSZip** — archive generation

## Privacy

Exported conversations and attachments may contain personal information.

- Keep generated archives private and secure.
- Never publish account tokens or other authentication credentials.
- Review requested extension permissions and credential handling before use.
- Export only data you are authorized to access.

The extension relies on Discord's accessible data and web-client behavior. Changes to Discord may affect compatibility, and the exporter cannot guarantee that every message or attachment will be available.

---

<div align="center">

### Built by Hidden Rhythm

*Made to keep the conversations worth coming back to.*

<br>

<a href="https://github.com/Hidden-Rhythm/Discord-msg-exporter">Repository</a>

</div>
