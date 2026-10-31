import { Router } from "express";
import { Notification } from "../models/index.js";
import { auth } from "../middleware/auth.js";
import { httpError, oid, wrap } from "../utils/http.js";

const router = Router();
router.use(auth);

router.get(
  "/",
  wrap(async (req, res) => {
    const items = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(100);
    res.json(items);
  })
);

router.get(
  "/unread-count",
  wrap(async (req, res) => {
    res.json({ count: await Notification.countDocuments({ userId: req.user._id, read: false }) });
  })
);

router.post(
  "/read-all",
  wrap(async (req, res) => {
    const r = await Notification.updateMany({ userId: req.user._id, read: false }, { $set: { read: true } });
    res.json({ updated: r.modifiedCount });
  })
);

router.post(
  "/:id/read",
  wrap(async (req, res) => {
    const n = await Notification.findOneAndUpdate({ _id: oid(req.params.id), userId: req.user._id }, { $set: { read: true } }, { returnDocument: "after" });
    if (!n) throw httpError(404, "Không tìm thấy thông báo");
    res.json(n);
  })
);

export default router;
