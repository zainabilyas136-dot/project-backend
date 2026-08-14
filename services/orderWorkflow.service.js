import { appError } from "../utils/errors.js";

export const ORDER_STATUSES = [
  "Draft",
  "Confirmed",
  "Processing",
  "Completed",
  "Cancelled",
];

const transitions = {
  Draft: new Set(["Confirmed"]),
  Confirmed: new Set(["Processing"]),
  Processing: new Set(["Completed"]),
  Completed: new Set(),
  Cancelled: new Set(),
};

export function assertValidTransition(currentStatus, nextStatus) {
  if (
    !ORDER_STATUSES.includes(nextStatus) ||
    !transitions[currentStatus]?.has(nextStatus)
  ) {
    throw appError(
      `Invalid status transition from ${currentStatus} to ${nextStatus}`,
    );
  }
}
