const {
  S3Client,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  GetObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const multer = require("multer");
const multerS3 = require("multer-s3");

const s3Client = new S3Client({
  endpoint: process.env.SPACES_ENDPOINT,
  region: process.env.SPACES_REGION,
  credentials: {
    accessKeyId: process.env.SPACES_ACCESS_KEY,
    secretAccessKey: process.env.SPACES_SECRET_KEY,
  },
  forcePathStyle: false,
});

const BUCKET = process.env.SPACES_BUCKET;
const ROOT = process.env.SPACES_ROOT || "acpayroll";

const deleteExistingUnderPrefix = async (prefix) => {
  const listCmd = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: prefix,
    MaxKeys: 10,
  });
  const listRes = await s3Client.send(listCmd);

  if (!listRes.Contents || listRes.Contents.length === 0) return;

  for (const obj of listRes.Contents) {
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.Key }));
    console.log(`[Spaces] Deleted: ${obj.Key}`);
  }
};

const uploadToTemp = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: BUCKET,
    key: (_req, file, cb) => {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${ROOT}/temp/${timestamp}-${safeName}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
}).single("photo");

/**
 * Move a file from temp to its final destination, replacing any existing file.
 * Returns the final key (storage path).
 *
 * @param {string} tempKey   - The key multer-s3 assigned (req.file.key)
 * @param {string} origin    - e.g. "staff"
 * @param {string} uuid      - e.g. staff ID
 * @param {string} filename  - original filename (req.file.originalname)
 * @returns {Promise<string>} finalKey
 */
const moveFromTemp = async (tempKey, origin, uuid, filename) => {
  const prefix = `${ROOT}/${origin}/${uuid}/`;
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const finalKey = `${prefix}${Date.now()}-${safeName}`;

  await deleteExistingUnderPrefix(prefix);

  await s3Client.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${tempKey}`,
      Key: finalKey,
    })
  );

  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: tempKey }));

  console.log(`[Spaces] Moved ${tempKey} → ${finalKey}`);
  return finalKey;
};

const moveFromTempKeepExisting = async (tempKey, origin, uuid, filename) => {
  const prefix = `${ROOT}/${origin}/${uuid}/`;
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const finalKey = `${prefix}${Date.now()}-${safeName}`;

  console.log("========== MOVE FILE ==========");
  console.log("TEMP KEY:", tempKey);
  console.log("FINAL KEY:", finalKey);

  const copyResult = await s3Client.send(
    new CopyObjectCommand({
      Bucket: BUCKET,
      CopySource: `${BUCKET}/${tempKey}`,
      Key: finalKey,
    })
  );

  console.log("COPY RESULT:", copyResult);

  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: tempKey,
    })
  );

  console.log("DELETE TEMP SUCCESS");

  return finalKey;
};

const deleteKey = async (key) => {
  if (!key) return;
  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  console.log(`[Spaces] Deleted: ${key}`);
};

/**
 * Generate a short-lived signed URL for a private object.
 * @param {string} key
 * @param {number} expiresIn  seconds (default 1 hour)
 */
const getSignedDownloadUrl = async (key, expiresIn = 3600) => {
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3Client, cmd, { expiresIn });
};

const uploadPhotosToTemp = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: BUCKET,
    key: (_req, file, cb) => {
      const timestamp = Date.now();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${ROOT}/temp/${timestamp}-${safeName}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
}).array("photos", 20);

module.exports = {
  uploadToTemp,
  uploadPhotosToTemp,
  moveFromTemp,
  moveFromTempKeepExisting,
  deleteKey,
  getSignedDownloadUrl,
};