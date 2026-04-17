import { Router } from "express";
import { respond, respondError, authMiddleware, type AuthRequest } from "../middlewares/auth";
import { upload } from "../middlewares/upload";
import path from "path";
import fs from "fs";
import { execute } from "../db/mysql";
import { table } from "../db/tables";

const router = Router();
router.use(authMiddleware);

router.post("/image", upload.single("file"), (req, res) => {
  if (!req.file) return respondError(res, "未收到文件");
  const url = `/uploads/${req.file.filename}`;
  return respond(res, { url, name: req.file.originalname, size: req.file.size });
});

router.post("/file", upload.single("file"), (req, res) => {
  if (!req.file) return respondError(res, "未收到文件");
  const url = `/uploads/${req.file.filename}`;
  return respond(res, { url, name: req.file.originalname, size: req.file.size });
});

router.post("/avatar", upload.single("file"), async (req: AuthRequest, res) => {
  if (!req.file) return respondError(res, "未收到文件");
  const url = `/uploads/${req.file.filename}`;
  if (req.user) {
    req.user.avatar = url;
    await execute(`UPDATE ${table("users")} SET avatar = ?, updated_at = ? WHERE id = ?`, [url, Date.now(), req.user.id]);
  }
  return respond(res, { url });
});

router.delete("/:id", (req, res) => {
  const uploadDir = path.join(__dirname, "..", "..", "uploads");
  const filepath = path.join(uploadDir, req.params.id);
  if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
  return respond(res, {});
});

export default router;

