require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const {
  S3Client,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");

const pool = new Pool({
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  host: process.env.PG_HOST,
  port: process.env.PG_PORT,
  database: process.env.PG_DATABASE,
});

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

const uploadsStaffDir = path.join(__dirname, "..", "uploads", "staff");

function cleanOldPath(photoUrl) {
  return String(photoUrl || "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "");
}

async function main() {
  console.log("Starting old staff photo migration...");

  const { rows } = await pool.query(`
    SELECT id, photo_url
    FROM public.staff
    WHERE photo_url IS NOT NULL
      AND TRIM(photo_url) <> ''
      AND (
        photo_url LIKE '/uploads/staff/%'
        OR photo_url LIKE 'uploads/staff/%'
      )
    ORDER BY id
  `);

  console.log(`Found ${rows.length} old staff photo records.`);

  for (const row of rows) {
    const oldPath = cleanOldPath(row.photo_url);
    const filename = path.basename(oldPath);
    const localFile = path.join(uploadsStaffDir, filename);

    if (!fs.existsSync(localFile)) {
      console.log(`SKIPPED staff ${row.id}: file not found -> ${localFile}`);
      continue;
    }

    const finalKey = `${ROOT}/staff/${row.id}/${filename}`;
    const body = fs.readFileSync(localFile);

    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: finalKey,
        Body: body,
      })
    );

    await pool.query(
      `
      UPDATE public.staff
      SET photo_url = $1
      WHERE id = $2
      `,
      [finalKey, row.id]
    );

    console.log(`MIGRATED staff ${row.id}: ${filename} -> ${finalKey}`);
  }

  console.log("Done.");
  await pool.end();
}

main().catch(async (err) => {
  console.error("Migration failed:", err);
  await pool.end();
  process.exit(1);
});