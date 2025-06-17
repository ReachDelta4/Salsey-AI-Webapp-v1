# Meeting Mojo

**The ultimate meeting assistant for sales professionals.**

Meeting Mojo is a commercial software tool designed to help sales teams, consultants, and founders close more deals. It captures every critical moment of your sales calls, provides AI-powered analysis to uncover client needs, and ensures you never miss a follow-up.

## The Problem

In a sales call, you're juggling multiple tasks: presenting your product, understanding the client's needs, handling objections, and taking notes on key details. Important buying signals, technical requirements, and stakeholder concerns can easily be missed. Post-call, manual CRM entry and follow-up emails are time-consuming and prone to error.

## The Solution

Meeting Mojo is your AI-powered co-pilot for every sales meeting. It provides:

-   **Live Transcription:** Focus on the conversation, not on note-taking. Meeting Mojo transcribes the entire call in real-time.
-   **AI-Driven Sales Insights:** Automatically identify customer pain points, budget discussions, key decision-makers, and action items.
-   **Centralized Intelligence:** A single source of truth for every customer interaction, enabling better forecasting and team collaboration.

With Meeting Mojo, you can ensure every lead is handled with precision and turn more conversations into revenue.

## Key Features for Sales Professionals

-   **🎙️ Real-time Transcription:** Accurately capture customer requirements and commitments.
-   **🚀 GPU Acceleration:** On-premise installations can leverage GPU support for maximum performance.
-   **🤖 AI Sales Insights:** Use Google Gemini to get call summaries, competitor mentions, and sentiment analysis.
-   **📝 Smart Notes & CRM Integration:** Take targeted notes that sync with your workflow and CRM.
-   **📺 Flawless Screen Sharing:** Present your product with a reliable screen-sharing feature.
-   **📄 Professional Exports:** Export call transcripts and summaries to PDF or DOCX for client proposals or internal review.
-   **🔐 Enterprise-Ready Security:** Built on a secure and scalable architecture to protect sensitive client data.
-   **🎨 Customizable Theme:** Light and dark mode support for your comfort.

## Technology Stack

This section provides an overview of the technologies used to build Meeting Mojo. It is intended for internal developers.

-   **Frontend:** React, TypeScript, Vite, Tailwind CSS
-   **Real-time STT Backend:** Python, WebSockets, `RealtimeSTT`, `faster-whisper`
-   **Backend (BaaS):** Supabase
-   **AI Model:** Google Gemini

## Getting Started (For Internal Developers)

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or higher)
-   [Python](https://www.python.org/) (v3.9 or higher)
-   (Optional for GPU) An NVIDIA GPU with CUDA drivers installed.

### 1. Clone the Repository

Access to the repository is restricted to authorized developers.

```bash
git clone <internal-repo-url>
cd meeting-mojo
```

### 2. Set Up Environment Variables

The application requires API keys for Supabase and Google AI.

1.  Create a `.env.local` file from the `.env.local.example` template.
2.  Add your assigned development credentials to `.env.local`:
    ```
    VITE_SUPABASE_URL="your-supabase-project-url"
    VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
    VITE_GEMINI_API_KEY="your-google-gemini-api-key"
    ```

### 3. Install Dependencies

-   **Frontend:**
    ```bash
    npm install
    ```
-   **STT Backend (Python):**

    -   For **CPU-based** transcription:
        ```bash
        pip install -r frontend/stt_backend/requirements.txt
        ```
    -   For **GPU-accelerated** transcription:
        ```bash
        pip install -r frontend/stt_backend/requirements-gpu.txt
        ```

## Running the Application

The easiest way to start the application is to run the frontend and the STT backend concurrently.

```bash
npm run dev
```

This command will:
1.  Start the Vite development server for the React frontend.
2.  Start the Python WebSocket server for real-time transcription.

## Copyright

© 2024 Your Company Name. All Rights Reserved. 