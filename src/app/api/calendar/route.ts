import { NextResponse } from "next/server";
import { corsair } from "@/server/corsair";
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/jwt";

const MOCK_EVENTS = [
  {
    id: "cal-1",
    summary: "Corsair MCP standup",
    start: "9:00 AM",
    end: "9:30 AM",
    timeRaw: "9:00 – 9:30 AM",
    date: "today",
    type: "users",
    details: "Dev Kumar, Priya S.",
    color: "#7c6af7",
  },
  {
    id: "cal-2",
    summary: "Hackathon demo review",
    start: "2:00 PM",
    end: "3:00 PM",
    timeRaw: "2:00 – 3:00 PM",
    date: "today",
    type: "video",
    details: "Google Meet",
    color: "#1d9e75",
  },
  {
    id: "cal-3",
    summary: "Submission deadline",
    start: "11:59 PM",
    end: "All day",
    timeRaw: "11:59 PM · All day",
    date: "tomorrow",
    type: "alert",
    details: "ChaiCode hackathon",
    color: "#e24b4a",
  },
  {
    id: "cal-4",
    summary: "Q3 roadmap sync",
    start: "10:00 AM",
    end: "11:00 AM",
    timeRaw: "10:00 – 11:00 AM",
    date: "tomorrow",
    type: "users",
    details: "Amit Mehta + team",
    color: "#378add",
  }
];

export async function GET() {
  try {
    const token = cookies().get("mailos_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = verifyJwt(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = payload.userId;

    const userCorsair = corsair.withTenant(userId);

    let isConnected = false;
    try {
      const accessToken = await userCorsair.googlecalendar.keys.get_access_token();
      isConnected = !!accessToken;
    } catch {}

    if (!isConnected) {
      return NextResponse.json({
        demo: true,
        events: MOCK_EVENTS,
      });
    }

    // Set search range: from 30 days ago to 30 days in the future
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - 30);
    timeMin.setHours(0, 0, 0, 0);

    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 30);
    timeMax.setHours(23, 59, 59, 999);

    const listResult = await userCorsair.googlecalendar.api.events.getMany({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const items = listResult.items || [];
    
    const formattedEvents = items.map((item) => {
      const startDateTime = item.start?.dateTime || item.start?.date || "";
      const endDateTime = item.end?.dateTime || item.end?.date || "";
      
      let startStr = "";
      let endStr = "";
      let timeRaw = "All day";
      let dateGroup = "today";

      if (startDateTime) {
        const startD = new Date(startDateTime);
        const endD = endDateTime ? new Date(endDateTime) : null;
        
        // Group by today vs tomorrow
        const today = new Date();
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        if (startD.getDate() === tomorrow.getDate() && startD.getMonth() === tomorrow.getMonth()) {
          dateGroup = "tomorrow";
        }

        // Format times
        if (item.start?.dateTime) {
          startStr = startD.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
          if (endD && item.end?.dateTime) {
            endStr = endD.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
            timeRaw = `${startStr} – ${endStr}`;
          } else {
            timeRaw = startStr;
          }
        }
      }

      // Determine type: video, users, or generic alert
      let type = "alert";
      let details = item.location || "";
      let color = "#378add"; // Default blue

      if (item.hangoutLink) {
        type = "video";
        details = "Google Meet";
        color = "#1d9e75"; // Green for video
      } else if (item.attendees && item.attendees.length > 0) {
        type = "users";
        details = item.attendees
          .map((a) => a.displayName || a.email?.split("@")[0] || "")
          .slice(0, 2)
          .join(", ") + (item.attendees.length > 2 ? " + team" : "");
        color = "#7c6af7"; // Purple for meetings
      }

      if (item.summary?.toLowerCase().includes("deadline") || item.summary?.toLowerCase().includes("urgent")) {
        type = "alert";
        color = "#e24b4a"; // Red for deadlines
      }

      return {
        id: item.id || Math.random().toString(),
        summary: item.summary || "Untitled Event",
        start: startStr,
        end: endStr,
        timeRaw,
        date: dateGroup,
        type,
        details,
        color,
        startDateTime,
        endDateTime,
      };
    });

    return NextResponse.json({
      demo: false,
      events: formattedEvents,
    });
  } catch (error: any) {
    console.error("Fetch Calendar API Error:", error);
    return NextResponse.json({
      demo: true,
      events: MOCK_EVENTS,
      error: error.message,
    });
  }
}

// POST /api/calendar — Create a new calendar event
export async function POST(req: Request) {
  try {
    const token = cookies().get("mailos_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const payload = verifyJwt(token);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = payload.userId;

    const userCorsair = corsair.withTenant(userId);

    const { summary, description, startDateTime, endDateTime, attendees, addMeet } =
      await req.json();

    if (!summary || !startDateTime || !endDateTime) {
      return NextResponse.json(
        { error: "Summary, start time, and end time are required" },
        { status: 400 }
      );
    }

    let isConnected = false;
    try {
      const accessToken = await userCorsair.googlecalendar.keys.get_access_token();
      isConnected = !!accessToken;
    } catch {}

    if (!isConnected) {
      return NextResponse.json({ demo: true, success: true });
    }

    const eventBody: any = {
      summary,
      description: description || "",
      start: {
        dateTime: startDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endDateTime,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    if (attendees && attendees.length > 0) {
      eventBody.attendees = attendees.map((email: string) => ({ email }));
    }

    if (addMeet) {
      eventBody.conferenceData = {
        createRequest: {
          requestId: Math.random().toString(36).slice(2),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      };
    }

    const result = await userCorsair.googlecalendar.api.events.create({
      calendarId: "primary",
      event: eventBody,
    });

    return NextResponse.json({ success: true, event: result });
  } catch (error: any) {
    console.error("Create Calendar Event Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
