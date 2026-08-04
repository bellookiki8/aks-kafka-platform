const express = require("express");
const { Kafka } = require("kafkajs");

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 3000;

// Kafka broker address, injected via env so it is not hardcoded.
const BROKER = process.env.KAFKA_BROKER || "kafka.kafka.svc.cluster.local:9092";
const TOPIC = "orders";

const kafka = new Kafka({ clientId: "order-producer", brokers: [BROKER] });
const producer = kafka.producer();

let connected = false;
async function connect() {
  await producer.connect();
  connected = true;
  console.log("Producer connected to Kafka at " + BROKER);
}
connect().catch((e) => console.error("Kafka connect error:", e.message));

app.get("/health", (req, res) => {
  res.json({ status: connected ? "ok" : "connecting", service: "producer" });
});

app.post("/orders", async (req, res) => {
  const order = {
    id: "order-" + Date.now(),
    item: req.body.item || "unknown",
    quantity: req.body.quantity || 1,
    createdAt: new Date().toISOString()
  };
  try {
    await producer.send({
      topic: TOPIC,
      messages: [{ key: order.id, value: JSON.stringify(order) }]
    });
    console.log("Published order:", order.id);
    res.status(202).json({ status: "accepted", order });
  } catch (e) {
    console.error("Publish failed:", e.message);
    res.status(500).json({ status: "error", message: e.message });
  }
});

app.listen(PORT, () => console.log("Producer API listening on port " + PORT));