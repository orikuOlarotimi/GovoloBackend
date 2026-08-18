// utils/verifyImage.js
const { fileTypeFromBuffer } = require("file-type");

const allowedRealTypes = ["jpg", "png", "webp", "avif", "heic", "heif"];

const verifyImageBuffer = async (buffer) => {
  const type = await fileTypeFromBuffer(buffer);

  if (!type) {
    return {
      valid: false,
      reason: "Unable to determine file type — file may be corrupted",
    };
  }

  if (!allowedRealTypes.includes(type.ext)) {
    return {
      valid: false,
      reason: `File content is actually .${type.ext}, not an allowed image type`,
    };
  }

  return { valid: true, mime: type.mime, ext: type.ext };
};

module.exports = verifyImageBuffer;
