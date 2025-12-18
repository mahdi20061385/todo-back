import express from "express";
import cors from "cors";
import webpush from "web-push";

const app = express();
app.use(cors()); // اگر دامنه مشخص است، اینجا محدود کن
app.use(express.json());

// تولید کلیدهای VAPID در شروع (برای تولید واقعی، ثابت نگه‌دار و محیطی کن)
const vapidKeys = webpush.generateVAPIDKeys();

webpush.setVapidDetails(
  "mailto:you@example.com",
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// ذخیره‌ی Subscription ها در حافظه (برای تولید واقعی: DB)
const subscriptions = new Map(); // key: endpoint, value: subscription

// برنامه‌ریزی ساده‌ی یادآوری‌ها در حافظه
const schedules = new Map(); // key: id, value: timeoutId

// ارائه کلید عمومی VAPID
app.get("/vapidPublicKey", (req, res) => {
  res.json({ key: vapidKeys.publicKey });
});

// ثبت subscription
app.post("/register", (req, res) => {
  const sub = req.body;
  if (!sub || !sub.endpoint)
    return res.status(400).json({ error: "invalid subscription" });
  subscriptions.set(sub.endpoint, sub);
  res.sendStatus(201);
});

// ارسال فوری برای تست
app.post("/send", async (req, res) => {
  const { title = "یادآوری", body = "" } = req.body || {};
  const payload = JSON.stringify({ title, body });
  try {
    await Promise.all(
      [...subscriptions.values()].map((sub) =>
        webpush.sendNotification(sub, payload)
      )
    );
    res.sendStatus(201);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "push failed" });
  }
});

// زمان‌بندی یادآوری
app.post("/schedule", (req, res) => {
  const { todoId, title, atISO, url } = req.body || {};
  if (!todoId || !title || !atISO)
    return res.status(400).json({ error: "missing fields" });

  const at = new Date(atISO).getTime();
  const now = Date.now();
  const delay = at - now;

  if (delay <= 0)
    return res.status(400).json({ error: "time must be in the future" });

  // setTimeout ساده (اگر سرور ریستارت شود، از بین می‌رود؛ برای تولید واقعی: cron + DB)
  const timeoutId = setTimeout(async () => {
    const payload = JSON.stringify({ title: "یادآوری", body: title, url });
    try {
      await Promise.all(
        [...subscriptions.values()].map((sub) =>
          webpush.sendNotification(sub, payload)
        )
      );
    } catch (err) {
      console.error("push error", err);
    } finally {
      schedules.delete(todoId);
    }
  }, delay);

  schedules.set(todoId, timeoutId);
  res.sendStatus(201);
});

// لغو زمان‌بندی (اختیاری)
app.post("/unschedule", (req, res) => {
  const { todoId } = req.body || {};
  if (!todoId) return res.status(400).json({ error: "missing todoId" });
  const timeoutId = schedules.get(todoId);
  if (timeoutId) {
    clearTimeout(timeoutId);
    schedules.delete(todoId);
  }
  res.sendStatus(200);
});

// پورت
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Push backend running on port ${PORT}`);
});
