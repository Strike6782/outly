/**
 * Cloudinary Config Tests — Unit
 *
 * The Cloudinary config module reads CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
 * and CLOUDINARY_API_SECRET from process.env at import time. It logs a warning
 * for each missing variable and calls cloudinary.config() with the values.
 *
 * Requirements: 1.1, 1.2
 */

// Mock cloudinary before importing the config module
jest.mock("cloudinary", () => ({
  v2: {
    config: jest.fn(),
    uploader: {},
  },
}));

describe("Cloudinary Config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("logs warnings when env vars are missing", () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;

    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    require("../../config/cloudinary");

    expect(warnSpy).toHaveBeenCalledTimes(3);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("CLOUDINARY_CLOUD_NAME"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("CLOUDINARY_API_KEY"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("CLOUDINARY_API_SECRET"));
    warnSpy.mockRestore();
  });

  it("does not log warnings when all env vars are set", () => {
    process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
    process.env.CLOUDINARY_API_KEY = "test-key";
    process.env.CLOUDINARY_API_SECRET = "test-secret";

    const warnSpy = jest.spyOn(console, "warn").mockImplementation();
    require("../../config/cloudinary");

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("calls cloudinary.config with correct values", () => {
    process.env.CLOUDINARY_CLOUD_NAME = "my-cloud";
    process.env.CLOUDINARY_API_KEY = "my-key";
    process.env.CLOUDINARY_API_SECRET = "my-secret";

    const { v2 } = require("cloudinary");
    require("../../config/cloudinary");

    expect(v2.config).toHaveBeenCalledWith({
      cloud_name: "my-cloud",
      api_key: "my-key",
      api_secret: "my-secret",
    });
  });
});
