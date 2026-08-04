const express = require("express");
const { Kafka } = require("kafkajs");

const app = express();
const PORT = process.env.PORT || 3000;

const BROKER = process.env.KAFKA_BROKER || "kafka.kafka.svc.cluster.local:9092";
const TOPIC = "orders";

// In-memory store of processed orders. Newest first, capped so it never grows
// without bound. A real system would use a database; this keeps the demo simple.
const processed = [];
const MAX = 100;

const kafka = new Kafka({ clientId: "order-consumer", brokers: [BROKER] });
const consumer = kafka.consumer({ groupId: "order-processors" });

async function run() {
  await consumer.connect();
  console.log("Consumer connected to Kafka at " + BROKER);
  await consumer.subscribe({ topic: TOPIC, fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ message, partition }) => {
      const order = JSON.parse(message.value.toString());
      // "Process" the order. In reality this might charge a card, reserve stock,
      // etc. Here we just stamp it fulfilled and record which partition it came from.
      order.status = "fulfilled";
      order.processedAt = new Date().toISOString();
      order.partition = partition;
      processed.unshift(order);
      if (processed.length > MAX) processed.pop();
      console.log("Processed order:", order.id, "from partition", partition);
    }
  });
}
run().catch((e) => console.error("Consumer error:", e.message));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "consumer", processedCount: processed.length });
});

// The frontend polls this to show processed orders.
app.get("/orders", (req, res) => {
  res.json({ count: processed.length, orders: processed });
});

app.listen(PORT, () => console.log("Consumer API listening on port " + PORT));