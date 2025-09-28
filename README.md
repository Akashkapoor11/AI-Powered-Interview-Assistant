# 🤖 AI-Powered Interview Assistant

An **AI-powered mock interview platform** that:
- Parses resumes (PDF/DOCX/Images with OCR).
- Generates tailored technical interview questions.
- Uses **Gemini (Google AI)** to evaluate answers with detailed feedback.
- Provides a **dashboard** for interviewers to review candidates, scores, and summaries.

Built with:
- ⚛️ React + TypeScript + Vite
- 🧩 Redux Toolkit + redux-persist
- 🎨 Ant Design (UI)
- 🧠 Google Gemini API (AI scoring & summaries)
- 🔍 Tesseract.js + pdf.js + mammoth (resume parsing)

---

## 📸 Features

✅ Resume upload (PDF, DOCX, JPG, PNG)  
✅ Auto extraction of **Name, Email, Phone**  
✅ Dynamic interview questions (EASY / MEDIUM / HARD)  
✅ Countdown timer per question  
✅ AI-powered scoring (fallback to offline heuristic if API unavailable)  
✅ Candidate dashboard with summaries & per-question breakdown  
✅ Save & export candidates (JSON)  
✅ Login, Logout & Reset session support  
✅ Fully responsive & Vercel-deployable  

## Vedio 
<!-- Failed to upload "AI Interview Assistant - Google Chrome 2025-09-28 15-53-09.mp4" -->
---
## Deployment Link
https://ai-powered-interview-assistant-czj7-5cpqsghpl.vercel.app/

## 🛠️ Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/Akashkapoor11/AI-Powered-Interview-Assistant.git
cd AI-Powered-Interview-Assistant
2. Install dependencies
bash
Copy code
npm install
3. Add your environment variables
Create a .env file in the project root:

env
Copy code
VITE_GEMINI_API_KEY=your_google_gemini_api_key_here
🔑 Get your Gemini API key from: Google AI Studio

4. Run locally
bash
Copy code
npm run dev
Visit 👉 http://localhost:5173

5. Build for production
bash
Copy code
npm run build
npm run preview
🚀 Deployment (Vercel)
Push your code to GitHub.

Go to Vercel.

Import the repo → Framework: Vite + React.

Add the environment variable under Settings → Environment Variables:

VITE_GEMINI_API_KEY

Deploy! 🎉



🤝 Contributing
Pull requests are welcome!
Open an issue for feature requests or bug fixes.

