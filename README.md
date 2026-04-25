<div align="center">
  <!-- <img src="asserts/zotero-claw.png" width="50%" /> -->

# ZoteroClaw

**OpenClaw For Zotero**

</div>

<div align="center">

[![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](LICENSE)
[![Zotero](https://img.shields.io/badge/Zotero-7.x-green.svg)](https://www.zotero.org/)
[![Zotero](https://img.shields.io/badge/Zotero-8.x-green.svg)](https://www.zotero.org/)
[![Zotero](https://img.shields.io/badge/Zotero-9.x-green.svg)](https://www.zotero.org/)

</div>

# Features

- **AI Chat Interface**: Chat with an AI assistant about your PDF documents
- **PDF Reference**: Easily reference the current PDF being viewed
- **File Attachments**: Upload files and attach them to your messages
- **Markdown Rendering**: Supports markdown formatting in AI responses
- **Streaming Responses**: Real-time streaming of AI responses
- **Session Management**: Persistent chat sessions stored across Zotero restarts
- **Connection Status**: Visual indicator for WebSocket connection state
- **History Loading**: Load and review previous chat history

# Support

- **Windows**: Supported
- **macOS**: Not Support Currently
- **Linux**: Not Support Currently

# How to Use

## Download XPI File

Download the latest `.xpi` file from the [Releases](https://github.com/windfollowingheart/zotero-claw/releases) page and install it in Zotero.

[github](https://github.com/windfollowingheart/zotero-claw/releases/download/v1.0.0/zotero-claw.xpi)
[gitee](https://gitee.com/windheartyolo/zotero-claw/releases/download/v1.0.0/zotero-claw.xpi)

## Download Backend Binary File

Download the backend service binary file [zotero-claw.exe](https://gitee.com/windheartyolo/zotero-claw/releases/download/backend_binary_file/zotero-claw.exe)

## Execute Backend Binary File

<div align="center">
  <img src="asserts/1.png" width="100%" />
</div>

### Settings Backend Service

Click the Settings button to configure the backend service.

<div align="center">
  <img src="asserts/2.png" width="70%" />
</div>

LLM Configuration should be set up before starting.

<div align="center">
  <img src="asserts/3.png" width="70%" />
</div>

### Start The Backend Service

Click the Start Service button to start the backend service.

<div align="center">
  <img src="asserts/4.png" width="70%" />
</div>

<div align="center">
  <img src="asserts/5.png" width="70%" />
</div>

## Execute Zotero Plugin

if the backend service is running before execute the plugin, the plugin will connect and load history automatically.

<div align="center">
  <img src="asserts/6.png" width="70%" />
</div>

if the backend service is not running, the plugin will be disconnected. You can click the Connect button to connect the plugin.

<div align="center">
  <img src="asserts/7.png" width="70%" />
</div>

Then the plugin will be connected and the history will be loaded automatically.

<div align="center">
  <img src="asserts/8.png" width="70%" />
</div>

## Chat with PDF

You can chat with the PDF attachment. Upload the PDF by:

1. Send PDF which is open in the Zotero Reader
2. Upload PDF file from your file system

<div align="center">
  <img src="asserts/9.png" width="70%" />
</div>

Then you can chat with ZoteroClaw about the PDF document.

<div align="center">
  <img src="asserts/10.png" width="70%" />
</div>

<div align="center">
  <img src="asserts/11.png" width="70%" />
</div>

# Thanks

- [Zotero Plugin Template](https://github.com/windingwind/zotero-plugin-template) - The foundation for this plugin
