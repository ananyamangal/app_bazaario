import { v2 as cloudinary } from "cloudinary";

// Cloudinary configuration
// Uses CLOUDINARY_URL from environment for credentials
// and enforces secure (https) URLs for all resources.
cloudinary.config({
  secure: true,
});

export default cloudinary;

