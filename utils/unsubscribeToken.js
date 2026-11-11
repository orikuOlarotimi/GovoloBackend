const crypto = require("crypto");

const sign = (subscriberId) => {
  if (!process.env.UNSUBSCRIBE_SECRET) {
    throw new Error("UNSUBSCRIBE_SECRET is not set");
  }
  return crypto
    .createHmac("sha256", process.env.UNSUBSCRIBE_SECRET)
    .update(String(subscriberId))
    .digest("hex");
};

const buildUnsubscribeUrl = (subscriberId) =>
  `${process.env.APP_URL}/unsubscribe/${subscriberId}/${sign(subscriberId)}`;

// Used by the unsubscribe endpoint in the next step
const isValidUnsubscribeToken = (subscriberId, token) => {
  if (typeof token !== "string") return false;
  const expected = Buffer.from(sign(subscriberId));
  const given = Buffer.from(token);
  return (
    expected.length === given.length && crypto.timingSafeEqual(expected, given)
  );
};

module.exports = { buildUnsubscribeUrl, isValidUnsubscribeToken };
