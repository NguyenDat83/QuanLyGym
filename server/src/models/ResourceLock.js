import mongoose from "mongoose";

// Collection kỹ thuật: khóa giao dịch theo "<loại>:<id>:<ngày>" để tuần tự hóa các lần đặt cạnh tranh
const lockSchema = new mongoose.Schema({
  _id: { type: String },
  revision: { type: Number, default: 0 },
});

export default mongoose.model("ResourceLock", lockSchema);
