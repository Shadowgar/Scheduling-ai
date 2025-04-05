# Scheduling AI - Completed Features Documentation

## Overview

This project is an AI-powered employee scheduling system with a ChatGPT-like interface, persistent chat history, and automated schedule management.

---

## Backend Features

### AI Integration

- Connects to Ollama AI model.
- Provides rich schedule context (per-employee, per-month summaries).
- Prompts AI to analyze, summarize, and suggest schedule changes.
- Parses AI-generated JSON schedule suggestions.
- Automatically applies schedule updates to the database.

### Schedule Management

- CRUD for employees and shifts.
- Schedule snapshots:
  - Save before AI changes.
  - Restore (undo) previous state.
  - List snapshots.

### Persistent Conversations

- Conversation model with:
  - Title
  - Messages (list of {role, text})
  - User association
  - Timestamps
- API endpoints to:
  - Create, list, get, update, delete conversations.

### Policy Management

- Upload, extract, and chunk policy documents (PDF, DOCX, TXT).
- View and manage policies.
- Serve original files.
- Integrate policy context into AI prompts.

---

## Frontend Features

### Chat Interface (Open WebUI style)

- Sidebar with:
  - List of saved conversations.
  - Inline renaming.
  - Delete button.
  - New chat button.
  - Undo last AI change button.
  - **Dark/light theme toggle**
  - **Settings panel**
- Main chat area:
  - Scrollable message history.
  - Fixed input box.
  - Streaming "Thinking..." indicator.
  - **Responsive Tailwind CSS design**
  - **Improved styling and hover effects**
- Persistent chat history via backend API.
- Calls AI API and updates conversation.
- Saves snapshot before AI changes.
- Displays AI responses and schedule suggestions.

### Schedule Calendar

- Month view with employees and shifts.
- Click to edit shifts (supervisors).
- Reflects AI-driven schedule changes.
- Undo AI changes via snapshot restore.

### Policy Manager

- Upload policy documents.
- View extracted text and original files.
- List, delete policies.

---

## How to Use

1. **Login** as supervisor.
2. **Chat with the AI** to:
   - Ask questions about the schedule.
   - Request schedule changes (e.g., "Schedule Paul afternoons in April").
3. **Review or undo** AI changes using the Undo button.
4. **Manage conversations**:
   - Rename, delete, switch chats.
5. **View and edit schedule** in the calendar.
6. **Upload and manage policies** in the Policy Manager.

---

## Summary

This system provides a powerful, AI-driven scheduling assistant with:

- Natural language chat interface.
- Persistent, multi-conversation history.
- Automated schedule modifications.
- Undo/redo capabilities.
- Policy document integration.
- Extensible backend and frontend architecture.

---

# End of Documentation
