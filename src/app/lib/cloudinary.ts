import { v2 as cloudinary } from "cloudinary";
import config from "../config";

const ensureCloudinaryConfigured = () => {
  if (
    !config.cloudinary_cloud_name ||
    !config.cloudinary_api_key ||
    !config.cloudinary_api_secret
  ) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
    );
  }

  cloudinary.config({
    cloud_name: config.cloudinary_cloud_name,
    api_key: config.cloudinary_api_key,
    api_secret: config.cloudinary_api_secret,
  });
};

export type CloudinaryUploadResult = {
  url: string;
  public_id: string;
};

/**
 * Uploads an in-memory file buffer to Cloudinary using the configured
 * credentials. Returns the secure URL and public id for later cleanup.
 */
export const uploadToCloudinary = (
  buffer: Buffer,
  folder: string,
): Promise<CloudinaryUploadResult> => {
  ensureCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    cloudinary.uploader
      .upload_stream({ folder }, (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary upload returned no result"));
          return;
        }

        resolve({
          url: result.secure_url,
          public_id: result.public_id,
        });
      })
      .end(buffer);
  });
};

export const deleteFromCloudinary = (publicId: string) => {
  if (!publicId) {
    return;
  }

  ensureCloudinaryConfigured();

  return cloudinary.uploader.destroy(publicId);
};
