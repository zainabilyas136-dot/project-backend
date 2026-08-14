import Counter from "../models/Counter.js";

export async function nextOrderNumber(session) {
  const counter = await Counter.findOneAndUpdate(
    { key: "sales-order" },
    { $inc: { sequence: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true, session },
  );
  return `ORD-${counter.sequence}`;
}
