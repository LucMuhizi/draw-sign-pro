import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface NotificationPayload {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

serve(async (req) => {
  try {
    const payload: NotificationPayload = await req.json();
    const { userId, title, body, data } = payload;

    const { data: devices, error } = await supabase
      .from("push_devices")
      .select("push_token")
      .eq("user_id", userId);

    if (error) throw error;
    if (!devices || devices.length === 0) {
      return new Response(JSON.stringify({ sent: false, reason: "no_devices" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const fcmPromises = devices.map(async (device) => {
      const fcmResponse = await fetch("https://fcm.googleapis.com/fcm/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `key=${Deno.env.get("FCM_SERVER_KEY")}`,
        },
        body: JSON.stringify({
          to: device.push_token,
          notification: { title, body },
          data: data || {},
        }),
      });
      return fcmResponse.json();
    });

    await Promise.all(fcmPromises);

    return new Response(JSON.stringify({ sent: true, count: devices.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
