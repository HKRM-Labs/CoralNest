import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";

const B2_KEY_ID = process.env.B2_KEY_ID!;
const B2_APPLICATION_KEY = process.env.B2_APPLICATION_KEY!;
const B2_BUCKET_NAME = process.env.B2_BUCKET_NAME ?? "coralnest-assets";
const B2_BUCKET_ENDPOINT =
  process.env.B2_BUCKET_ENDPOINT ?? "https://s3.us-west-004.backblazeb2.com";

const s3 = new S3Client({
  endpoint: B2_BUCKET_ENDPOINT,
  region: "us-west-004",
  credentials: { accessKeyId: B2_KEY_ID, secretAccessKey: B2_APPLICATION_KEY },
  forcePathStyle: true,
});

async function emptyBucket() {
  console.log("==================================================================");
  console.log("🗑️  EMPTYING BACKBLAZE B2 BUCKET:", B2_BUCKET_NAME);
  console.log("==================================================================");

  let totalDeleted = 0;
  let continuationToken: string | undefined;

  do {
    const list = await s3.send(
      new ListObjectsV2Command({
        Bucket: B2_BUCKET_NAME,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      }),
    );

    const objects = list.Contents ?? [];
    if (objects.length === 0) {
      console.log("   ✅ Bucket is already empty.");
      break;
    }

    const toDelete = objects.map((o) => ({ Key: o.Key! }));
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: B2_BUCKET_NAME,
        Delete: { Objects: toDelete, Quiet: true },
      }),
    );

    totalDeleted += objects.length;
    process.stdout.write(`   🗑️  Deleted ${totalDeleted} objects so far...\r`);
    continuationToken = list.NextContinuationToken;
  } while (continuationToken);

  console.log(
    `\n✅ B2 bucket '${B2_BUCKET_NAME}' is now completely empty (${totalDeleted} objects removed).`,
  );
}

void emptyBucket().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
