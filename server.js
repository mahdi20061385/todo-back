import express from "express";
import cors from "cors";
import webpush from "web-push";

const app = express();
app.use(cors());
app.use(express.json());

// تولید کلیدهای VAPID در شروع (برای تولید واقعی، ثابت نگه‌دار و محیطی کن)
const vapidKeys = webpush.generateVAPIDKeys();

webpush.setVapidDetails(
  "mailto:you@example.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// ذخیره‌ی Subscription ها در حافظه (برای تولید واقعی: DB)
const subscriptions = new Map(); // key: deviceId, value: subscription

// ارائه کلید عمومی VAPID
app.get("/vapidPublicKey", (req, res) => {
  res.json({ key: vapidKeys.publicKey });
});

// ثبت subscription برای هر دستگاه جدا
app.post("/register", (req, res) => {
  const { deviceId, subscription } = req.body;
  if (!deviceId || !subscription) {
    return res.status(400).json({ error: "invalid subscription" });
  }
  subscriptions.set(deviceId, subscription);
  res.sendStatus(201);
});

// ارسال فوری برای تست (فقط به یک دستگاه خاص)
app.post("/send", async (req, res) => {
  const { deviceId, title = "یادآوری", body = "" } = req.body || {};
  const sub = subscriptions.get(deviceId);
  if (!sub) return res.status(404).json({ error: "subscription not found" });

  const payload = JSON.stringify({ title, body });
  try {
    await webpush.sendNotification(sub, payload);
    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "push failed" });
  }
});

// زمان‌بندی اعلان فقط برای همان deviceId
app.post("/schedule", (req, res) => {
  const { todoId, title, atISO, deviceId } = req.body;
  const sub = subscriptions.get(deviceId);
  if (!sub) return res.status(404).json({ error: "subscription not found" });
  if (!todoId || !title || !atISO) {
    return res.status(400).json({ error: "missing fields" });
  }

  const delay = new Date(atISO).getTime() - Date.now();
  if (delay <= 0) {
    return res.status(400).json({ error: "time must be in the future" });
  }

  setTimeout(() => {
    const payload = JSON.stringify({ title: "یادآوری", body: title });
    webpush.sendNotification(sub, payload).catch(console.error);
  }, delay);

  res.sendStatus(201);
});

// پورت
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Push backend running on port ${PORT}`);
});
