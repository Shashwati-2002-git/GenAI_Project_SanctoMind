import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import pkg from 'pg';

const app = express();
app.use(cors());
app.use(bodyParser.json());

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: { rejectUnauthorized: false } // required for Render
});

// Path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "apikey.env") });

// Serve static files (your HTML, JS, CSS) from project root
app.use(express.static(__dirname));

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing. Check apikey.env file.");
}
else {
  console.log("✅ GEMINI_API_KEY loaded successfully.");
}

app.get("/api/test-db", async (req, res) => {
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    client.release();
    res.json({ now: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "DB connection failed" });
  }
});

//  Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Serve your HTML file when user visits root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/chat", async (req, res) => {
  const userMessage = req.body.message;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Safer: just pass string, not array
    const result = await model.generateContent(userMessage);

    const reply = result.response?.candidates?.[0]?.content?.parts?.[0]?.text 
               || "⚠️ No reply received from Gemini.";

    res.json({ reply });
  } catch (error) {
    console.error("❌ Gemini error (full):", error);

    // Return user-friendly error instead of 500
    if (error.status === 503) {
      return res.status(503).json({ reply: "⚠️ Gemini servers are busy, please try again later." });
    }

    res.status(500).json({ reply: "⚠️ Sorry, something went wrong on the server." });
  }
});

// General Chat API - empathetic mental health chatbot
app.post("/api/general-chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ reply: "⚠️ Message cannot be empty." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Prompt for empathetic, therapeutic guidance and possible mental health evaluation
    const prompt = `
      You are a mental health AI counsellor. Based on the user's message, determine the most likely mental health condition the user is suffering with. 
      Then, choose **only one random professional** from the list below corresponding to that condition. 
      Professionals by disorder:
      - General Mental Health: Dr. Priya Sharma, Dr. Amit Verma
      - Anxiety & Depression: Dr. Neha Singh, Dr. Rahul Kapoor
      - OCD: Dr. Anjali Rao, Dr. Karan Mehta
      - ADHD: Dr. Sameer Joshi, Dr. Pooja Iyer
      - Bipolar Disorder: Dr. Alok Bhatt, Dr. Nisha Malhotra
      - PTSD: Dr. Rekha Menon, Dr. Tarun Chawla

      Rules:
      1. Provide the name of the mental health condition.
      2. Give a concise, empathetic, and therapeutic response to the user's message.
      3. Provide the name of the chosen professional and a link to their profile. 
      4. Generate the link in lowercase with hyphens replacing spaces in the format "https://sanctomind.com/connect/dr-priya-sharma".
      5. Keep the reply concise.

      User's message: "${userMessage}"
    `;

    const result = await model.generateContent(prompt);

    const reply =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "⚠️ Sorry, I couldn't process that. Please try again.";

    res.json({ reply });
  } catch (error) {
    console.error("❌ General chat error:", error);
    if (error.status === 503) {
      return res.status(503).json({ reply: "⚠️ Gemini servers are busy, try again later." });
    }
    res.status(500).json({ reply: "⚠️ Something went wrong on the server." });
  }
});

// ✅ Specialised Chat API
app.post("/api/specialised-chat", async (req, res) => {
  const { disorder, message } = req.body;

  if (!disorder || !message) {
    return res.status(400).json({ reply: "❌ Disorder and message are required." });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an empathetic mental health counsellor specializing in ${disorder}.
      The user is seeking counselling and therapy support for this condition.

      Choose **only one random professional** from the list below corresponding to that condition. 
      Professionals by disorder:
      - General Mental Health: Dr. Priya Sharma, Dr. Amit Verma
      - Anxiety & Depression: Dr. Neha Singh, Dr. Rahul Kapoor
      - OCD: Dr. Anjali Rao, Dr. Karan Mehta
      - ADHD: Dr. Sameer Joshi, Dr. Pooja Iyer
      - Bipolar Disorder: Dr. Alok Bhatt, Dr. Nisha Malhotra
      - PTSD: Dr. Rekha Menon, Dr. Tarun Chawla

      Rules:
      1. Give a concise, empathetic, and therapeutic response to the user's message.
      2. Provide the name of the chosen professional and a link to their profile. 
      3. Generate the link in lowercase with hyphens replacing spaces in the format "https://sanctomind.com/connect/dr-priya-sharma".
      4. Keep the reply concise.
      
      Guidelines:
      - Respond in a calm, supportive, and non-judgmental tone.
      - Focus on emotional support, coping techniques, and general advice relevant to ${disorder}.
      - Encourage seeking professional help if the condition is severe.
      
      User message: "${message}"
      
      Provide a concise, empathetic, and disorder-focused reply.
    `;

    const result = await model.generateContent(prompt);

    const reply =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "⚠️ No reply received from Gemini.";

    res.json({ reply });
  } catch (error) {
    console.error("❌ Specialised Chat API error:", error);

    if (error.status === 503) {
      return res.status(503).json({
        reply: "⚠️ Gemini servers are busy, please try again later.",
      });
    }

    res.status(500).json({
      reply: "⚠️ Sorry, something went wrong on the server.",
    });
  }
});

// ✅ Quiz API (generate questions or evaluate answers)
app.post("/api/quiz", async (req, res) => {
  try {
    const { type, disorder, answers } = req.body;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let prompt;

    if (!answers) {
      // Generate questions
      prompt = `Generate 10 yes/no questions to ${
        type === "progress" ? "track progress of" : "diagnose"
      } ${disorder}. Only provide the questions in a numbered list.`;
    } else {
      // Evaluate answers
      prompt = `
        Here are the answers to a ${type} quiz for ${disorder}.
        Questions and answers: ${JSON.stringify(answers)}.
        
        1. Evaluate these answers and give a score out of 100.
        2. After the score, also provide a short recommendation on whether 
           the person should consult a mental health professional or not.
        3. For general mental health quiz in the diagnosis type, provide only a 
           list of possible conditions they might have based on their answers
           and no explanations to why they might have these conditions to keep the response concise.
           
        Format the reply as:
        "Your score is X/100."
        "Recommendation: [your advice here]"
        "Possible conditions: [list of conditions]" (only for general mental health diagnosis quiz)
      `;
    }

    const result = await model.generateContent([prompt]);

    const reply =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "⚠️ No reply received from Gemini.";

    res.json({ reply });
  } catch (error) {
    console.error("❌ Quiz API error:", error);
    res.status(500).json({ reply: "⚠️ Failed to generate quiz." });
  }
});

app.post("/generate", async (req, res) => {
  try {
    const response = await generateContent(req.body);
    res.json(response);
  } catch (err) {
    if (err.status === 429) {
      const retryAfter = err.errorDetails?.find(d => d['@type']?.includes('RetryInfo'))?.retryDelay || "a few seconds";
      return res.status(429).json({ 
        error: `Rate limit exceeded. Try again after ${retryAfter}.`
      });
    }
    console.error("Gemini API error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/checklist-response", async (req, res) => {
  try {
    const { disorder, tasks, type } = req.body;

    if (!disorder) {
      return res.status(400).json({ error: "Disorder is required" });
    }
    let prompt = "";

    if (type === "checklist") {
      // Generate a checklist of 5 tasks
      prompt = `Provide a checklist of 5 daily tasks to help manage ${disorder}. 
      Keep them short, practical, and empathetic. Return only the tasks in numbered list.`;
    } else if (type === "remarks") {
      // Generate remarks depending on task completion
      const completed = tasks.filter(t => t.done).length;
      const total = tasks.length;

      if (completed === total) {
        prompt = `The user has successfully completed all ${total} tasks for ${disorder}.
        Write an empathetic and encouraging remark that motivates them to keep going.`;
      } else {
        prompt = `The user completed ${completed} out of ${total} tasks for ${disorder}.
        Write a supportive remark: explain kindly why finishing all tasks is important,
        mention possible consequences of missing tasks, and motivate them to try again tomorrow.`;
      }
    } else {
      return res.status(400).json({ error: "Invalid type" });
    }

    // Call Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);

    const text = result.response.text();
    res.json({ message: text });
  } catch (err) {
    console.error("Checklist Response Error:", err);
    res.status(500).json({ error: "Failed to generate checklist or remarks" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});