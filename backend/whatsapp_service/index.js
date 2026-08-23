const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 8005;

app.use(cors());
app.use(express.json());

let clientStatus = "INITIALIZING"; // "INITIALIZING" | "QR_READY" | "CONNECTED" | "DISCONNECTED"
let latestQr = null;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, ".wwebjs_auth") }),
  puppeteer: {
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
  },
  webVersionCache: { type: "remote", remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html" },
  webVersionCache: { type: "remote", remotePath: "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html" },
});

client.on("qr", async (qr) => {
  try {
    clientStatus = "QR_READY";
    latestQr = await qrcode.toDataURL(qr);
    console.log("👉 New WhatsApp QR Code generated. Ready to scan!");
  } catch (err) {
    console.error("Failed to generate QR data URL:", err);
  }
});

client.on("authenticated", () => {
  console.log("✅ WhatsApp Client Authenticated!");
});

client.on("auth_failure", (msg) => {
  console.error("❌ WhatsApp Auth failure:", msg);
  clientStatus = "DISCONNECTED";
  latestQr = null;
});

client.on("ready", () => {
  clientStatus = "CONNECTED";
  latestQr = null;
  console.log("🚀 WhatsApp Client is READY!");
});

client.on("disconnected", (reason) => {
  console.warn("⚠️ WhatsApp Client Disconnected:", reason);
  clientStatus = "DISCONNECTED";
  latestQr = null;
  // Attempt to re-initialize after a short delay
  setTimeout(() => {
    try {
      client.initialize();
    } catch (e) {
      console.error("Failed to reinitialize:", e);
    }
  }, 5000);
});


// Initialize the client with retry logic for navigation errors
const initializeWithRetry = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`Attempting to initialize WhatsApp client (attempt ${i + 1}/${retries})...`);
      await client.initialize();
      console.log('WhatsApp client initialization triggered successfully.');
      return;
    } catch (err) {
      console.error(`Error initializing WhatsApp client on attempt ${i + 1}:`, err.message);
      if (err.message.includes("Execution context was destroyed") && i < retries - 1) {
        console.log("Navigation detected, retrying in 3 seconds...");
        await new Promise(res => setTimeout(res, 3000));
      } else {
        break;
      }
    }
  }
};

initializeWithRetry();


// API Routes
app.get("/status", (req, res) => {
  res.json({
    status: clientStatus,
    qr: latestQr,
  });
});

app.post("/send", async (req, res) => {
  const { phone, message } = req.body;
  if (!phone || !message) {
    return res.status(400).json({ error: "Missing phone or message parameter" });
  }

  if (clientStatus !== "CONNECTED") {
    return res.status(400).json({ error: "WhatsApp client is not connected" });
  }

  try {
    // Sanitize phone number (keep only digits)
    let cleanedPhone = phone.replace(/\D/g, "");
    
    // Check if it already has the suffix, if not append it
    if (!cleanedPhone.endsWith("@c.us") && !cleanedPhone.endsWith("@g.us")) {
      cleanedPhone = `${cleanedPhone}@c.us`;
    }

    console.log(`Sending message to ${cleanedPhone}: "${message.substring(0, 40)}..."`);
    const result = await client.sendMessage(cleanedPhone, message);
    
    res.json({
      success: true,
      messageId: (result && result.id && result.id.id) ? result.id.id : "unknown",
    });
  } catch (err) {
    console.error("Failed to send WhatsApp message:", err);
    res.status(500).json({ error: err.message || "Failed to send message" });
  }
});

app.post("/logout", async (req, res) => {
  try {
    await client.logout();
    clientStatus = "DISCONNECTED";
    latestQr = null;
    res.json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("Failed to logout client:", err);
    res.status(500).json({ error: err.message || "Failed to logout client" });
  }
});

app.listen(PORT, () => {
  console.log(`WhatsApp Service listening on port ${PORT}`);
});
