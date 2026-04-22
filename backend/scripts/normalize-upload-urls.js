require("dotenv").config({ path: require("path").join(__dirname, "..", ".env"), quiet: true });

const { prisma } = require("../src/db/prisma");

function normalizeUploadUrl(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  const matched = trimmed.match(/^https?:\/\/[^/]+(\/uploads\/.+)$/i);
  if (matched) {
    return matched[1];
  }

  return trimmed;
}

function normalizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return metadata;
  }

  const nextMetadata = { ...metadata };

  if (Array.isArray(nextMetadata.images)) {
    nextMetadata.images = nextMetadata.images.map((item) => normalizeUploadUrl(item));
  }

  if (Array.isArray(nextMetadata.fileAttachments)) {
    nextMetadata.fileAttachments = nextMetadata.fileAttachments.map((item) => {
      if (!item || typeof item !== "object") {
        return item;
      }

      return {
        ...item,
        url: normalizeUploadUrl(item.url),
      };
    });
  }

  return nextMetadata;
}

async function main() {
  const posts = await prisma.post.findMany({
    select: {
      id: true,
      attachments: true,
      metadata: true,
    },
  });

  let updatedCount = 0;

  for (const post of posts) {
    const currentAttachments = Array.isArray(post.attachments) ? post.attachments : [];
    const nextAttachments = currentAttachments.map((item) => normalizeUploadUrl(item));
    const currentMetadata = post.metadata && typeof post.metadata === "object" ? post.metadata : {};
    const nextMetadata = normalizeMetadata(currentMetadata);

    const attachmentsChanged = JSON.stringify(currentAttachments) !== JSON.stringify(nextAttachments);
    const metadataChanged = JSON.stringify(currentMetadata) !== JSON.stringify(nextMetadata);

    if (!attachmentsChanged && !metadataChanged) {
      continue;
    }

    await prisma.post.update({
      where: { id: post.id },
      data: {
        attachments: nextAttachments,
        metadata: nextMetadata,
      },
    });

    updatedCount += 1;
  }

  console.log(JSON.stringify({ ok: true, updatedCount }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
