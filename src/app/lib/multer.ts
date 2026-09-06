import multer from "multer";

const storage = multer.memoryStorage();
const fileFilter: multer.Options["fileFilter"] = (req, file, callback) => {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/avif",
    "application/octet-stream",
    "",
  ];

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return callback(
      new Error("Only JPEG, PNG, WEBP and AVIF images are allowed."),
    );
  }

  callback(null, true);
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const upload = multer({
  storage: storage,
  fileFilter,
  limits: { fileSize: MAX_FILE_SIZE },
});

export const detectImageType = (buffer: Buffer): string | null => {
  if (!buffer || buffer.length < 4) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d
  ) {
    return "image/png";
  }

  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  if (
    buffer.toString("ascii", 4, 8) === "ftyp" &&
    ["avif", "avis"].includes(buffer.toString("ascii", 8, 12))
  ) {
    return "image/avif";
  }

  return null;
};
