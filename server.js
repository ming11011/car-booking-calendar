const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

// 初始化 Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const app = express();
app.use(cors());
app.use(express.json());

// 测试 API
app.get("/", (req, res) => {
  res.send("Car Booking API with Supabase is running!");
});

// 获取所有车辆
app.get("/cars", async (req, res) => {
  const { data, error } = await supabase.from("cars").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});


// 预约车辆
app.post("/book", async (req, res) => {
  const { car_id, user_name, booking_date } = req.body;

  if (!car_id || !user_name || !booking_date) {
    return res.status(400).json({ error: "缺少必要参数" });
  }

  // 检查车辆是否已被预订
  const { data: existing, error: checkError } = await supabase
    .from("bookings")
    .select("*")
    .eq("car_id", car_id)
    .eq("booking_date", booking_date);

  if (checkError) return res.status(500).json({ error: checkError.message });
  if (existing.length > 0) {
    return res.status(400).json({ error: "这辆车在当天已被预订" });
  }

  // 插入预订记录
  const { data, error } = await supabase
    .from("bookings")
    .insert([{ car_id, user_name, booking_date }])
    .select();

  if (error) return res.status(500).json({ error: error.message });

  // 更新车辆状态（可选：只在当天 disable）
  await supabase
    .from("cars")
    .update({ status: "booked" })
    .eq("id", car_id);

  res.json(data[0]);
});


// 替换使用人
app.post("/replace", async (req, res) => {
  const { booking_id, new_user } = req.body;

  if (!booking_id || !new_user) {
    return res.status(400).json({ error: "缺少必要参数" });
  }

  // 先找原始预订
  const { data: booking, error: findError } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", booking_id)
    .single();

  if (findError || !booking) {
    return res.status(404).json({ error: "找不到该预约" });
  }

  // 插入到历史记录
  await supabase.from("booking_history").insert([
    {
      booking_id,
      old_user: booking.user_name,
      new_user,
    },
  ]);

  // 更新预订人
  const { data, error } = await supabase
    .from("bookings")
    .update({ user_name: new_user, updated_at: new Date() })
    .eq("id", booking_id)
    .select();

  if (error) return res.status(500).json({ error: error.message });

  res.json(data[0]);
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
