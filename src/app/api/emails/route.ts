import { NextResponse } from "next/server";
import { corsair } from "@/server/corsair";

// Premium Mockup Emails for Demo/Fallback Mode
const MOCK_EMAILS = [
  {
    id: "mock-1",
    from: "Dev Kumar · Corsair",
    subject: "Re: MCP integration",
    snippet: "Hey, just reviewed the new MCP schemas. They look good to go. Let's sync up...",
    date: "2m ago",
    priority: "high",
    unread: true,
    labelIds: ["INBOX", "STARRED"],
  },
  {
    id: "mock-2",
    from: "Priya Sharma",
    subject: "Hackathon submission",
    snippet: "Just a reminder that the submission portal closes tomorrow. Make sure to double check...",
    date: "18m ago",
    priority: "high",
    unread: true,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-3",
    from: "Amit Mehta · PM",
    subject: "Q3 roadmap review",
    snippet: "Team, I need everyone to review the Q3 planning document and drop their comments...",
    date: "45m ago",
    priority: "med",
    unread: false,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-4",
    from: "GitHub",
    subject: "[mailos] PR #14 approved",
    snippet: "corsairdev approved pull request #14: Fix token refresh handler in oauth clients...",
    date: "1h ago",
    priority: "low",
    unread: false,
    labelIds: ["SENT"],
  },
  {
    id: "mock-5",
    from: "Neha Kapoor",
    subject: "Lunch Thursday?",
    snippet: "Haven't seen you in a while! Are you free for lunch this Thursday at 12:30? Let's check...",
    date: "3h ago",
    priority: "med",
    unread: false,
    labelIds: ["DRAFT"],
  },
  {
    id: "mock-6",
    from: "Vercel",
    subject: "Your deployment is live",
    snippet: "Your project mailos-app has been successfully deployed. Production URL is available...",
    date: "5h ago",
    priority: "low",
    unread: false,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-7",
    from: "ChaiCode Newsletter",
    subject: "This week in dev",
    snippet: "Welcome to this week's digest of all things web development, AI engineering, and more...",
    date: "Yesterday",
    priority: "low",
    unread: false,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-8",
    from: "Rahul Patel",
    subject: "Re: API keys setup",
    snippet: "I've added the new dev credentials to the vault. Let me know if you face issues...",
    date: "Yesterday",
    priority: "med",
    unread: false,
    labelIds: ["INBOX", "STARRED"],
  },
  {
    id: "mock-9",
    from: "Saurabh Jain",
    subject: "Docker compose issue on Windows",
    snippet: "I ran into the same issue with Docker Desktop. Make sure the WSL2 backend is enabled...",
    date: "Yesterday",
    priority: "med",
    unread: true,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-10",
    from: "LinkedIn",
    subject: "3 new job recommendations for you",
    snippet: "Based on your profile, we found roles at Google, Microsoft, and Amazon that match...",
    date: "Yesterday",
    priority: "low",
    unread: false,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-11",
    from: "Stripe",
    subject: "Your invoice for June 2026",
    snippet: "Your monthly invoice is ready. Amount due: $29.00. View your invoice details...",
    date: "2d ago",
    priority: "med",
    unread: false,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-12",
    from: "Ananya Desai",
    subject: "Re: Design feedback",
    snippet: "The new sidebar layout looks much cleaner. I have a few minor suggestions on the...",
    date: "2d ago",
    priority: "med",
    unread: false,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-13",
    from: "AWS",
    subject: "Your AWS bill for May 2026",
    snippet: "Your total charges for the billing period are $14.72. View your detailed bill...",
    date: "2d ago",
    priority: "low",
    unread: false,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-14",
    from: "Slack",
    subject: "You have 12 unread messages",
    snippet: "Catch up on messages from #engineering, #random, and 2 direct messages...",
    date: "3d ago",
    priority: "low",
    unread: false,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-15",
    from: "Hitesh Choudhary",
    subject: "New course launch: System Design",
    snippet: "Hey! I just published a brand new course on System Design fundamentals. Check it out...",
    date: "3d ago",
    priority: "med",
    unread: true,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-16",
    from: "Google Cloud",
    subject: "Your free trial credits are expiring",
    snippet: "Your Google Cloud free trial credits of $300 will expire in 7 days. Upgrade your...",
    date: "3d ago",
    priority: "med",
    unread: false,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-17",
    from: "Notion",
    subject: "What's new in Notion — June update",
    snippet: "We've added AI-powered summaries, improved database views, and a brand new calendar...",
    date: "4d ago",
    priority: "low",
    unread: false,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-18",
    from: "Ravi Shankar",
    subject: "Weekend trek plan",
    snippet: "Are you in for the Sahyadri trek this weekend? We're planning to start early morning...",
    date: "4d ago",
    priority: "low",
    unread: false,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-19",
    from: "Figma",
    subject: "Your design file was updated",
    snippet: "Ananya Desai made changes to 'MailOS UI v2'. Open the file to review the latest...",
    date: "5d ago",
    priority: "low",
    unread: false,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-20",
    from: "Dev.to",
    subject: "Your article got 500+ views!",
    snippet: "Congratulations! Your article 'Building a Gmail Clone with Next.js' is trending...",
    date: "5d ago",
    priority: "low",
    unread: false,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-21",
    from: "Meera Singh",
    subject: "Interview prep resources",
    snippet: "Here are the DSA sheets and system design links I mentioned. Start with the graphs...",
    date: "6d ago",
    priority: "med",
    unread: false,
    labelIds: ["INBOX", "STARRED"],
  },
  {
    id: "mock-22",
    from: "npm",
    subject: "Security advisory for your packages",
    snippet: "A moderate severity vulnerability was found in a dependency of mailos-app...",
    date: "1w ago",
    priority: "high",
    unread: false,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-23",
    from: "Google Security",
    subject: "New sign-in from Chrome on Windows",
    snippet: "We noticed a new sign-in to your Google Account from a device you haven't used before...",
    date: "1w ago",
    priority: "high",
    unread: false,
    labelIds: ["INBOX"],
  },
  {
    id: "mock-24",
    from: "Spotify",
    subject: "Your Discover Weekly is ready",
    snippet: "We've picked 30 songs we think you'll love. Tap to listen to your personalized mix...",
    date: "1w ago",
    priority: "low",
    unread: false,
    labelIds: ["INBOX"],
  },
];

export async function GET() {
  try {
    // Check if Gmail is connected by looking up the access token
    let isConnected = false;
    try {
      const accessToken = await corsair.gmail.keys.get_access_token();
      isConnected = !!accessToken;
    } catch {}

    if (!isConnected) {
      // Return demo emails if not connected
      return NextResponse.json({
        demo: true,
        emails: MOCK_EMAILS,
      });
    }

    // Gmail is connected, fetch live messages
    const listResult = await corsair.gmail.api.messages.list({ maxResults: 50 });
    const messages = listResult.messages || [];

    if (messages.length === 0) {
      return NextResponse.json({
        demo: false,
        emails: [],
      });
    }

    // Fetch details for each message
    const detailedEmails = await Promise.all(
      messages.map(async (msg) => {
        try {
          const details = await corsair.gmail.api.messages.get({
            id: msg.id!,
            format: "full",
          });

          const headers = details.payload?.headers || [];
          const fromHeader = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "Unknown";
          const subjectHeader = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "No Subject";
          const dateHeader = headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";

          // Simple basic priority classifier (heuristic) for Day 1
          let priority = "low";
          const textToAnalyze = `${fromHeader} ${subjectHeader}`.toLowerCase();
          if (textToAnalyze.includes("urgent") || textToAnalyze.includes("action required") || textToAnalyze.includes("important")) {
            priority = "high";
          } else if (textToAnalyze.includes("review") || textToAnalyze.includes("roadmap") || textToAnalyze.includes("meeting")) {
            priority = "med";
          }

          // Format Date to a relative or readable format
          let displayDate = "Just now";
          if (dateHeader) {
            try {
              const dateObj = new Date(dateHeader);
              const diffMs = Date.now() - dateObj.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              const diffHours = Math.floor(diffMins / 60);

              if (diffMins < 60) {
                displayDate = diffMins <= 0 ? "Just now" : `${diffMins}m ago`;
              } else if (diffHours < 24) {
                displayDate = `${diffHours}h ago`;
              } else {
                displayDate = dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" });
              }
            } catch {
              displayDate = dateHeader;
            }
          }

          return {
            id: msg.id,
            from: fromHeader,
            subject: subjectHeader,
            snippet: details.snippet || "",
            date: displayDate,
            priority,
            unread: details.labelIds?.includes("UNREAD") || false,
            labelIds: details.labelIds || [],
          };
        } catch (e) {
          return {
            id: msg.id,
            from: "Unknown",
            subject: "Error loading message details",
            snippet: "",
            date: "",
            priority: "low",
            unread: false,
          };
        }
      })
    );

    return NextResponse.json({
      demo: false,
      emails: detailedEmails,
    });
  } catch (error: any) {
    console.error("Fetch Emails API Error:", error);
    // On error, fallback to mock emails so the app UI doesn't crash
    return NextResponse.json({
      demo: true,
      emails: MOCK_EMAILS,
      error: error.message,
    });
  }
}

// POST /api/emails — Send a new email
export async function POST(req: Request) {
  try {
    const { to, subject, body } = await req.json();

    if (!to || !subject) {
      return NextResponse.json(
        { error: "Recipient and subject are required" },
        { status: 400 }
      );
    }

    let isConnected = false;
    try {
      const accessToken = await corsair.gmail.keys.get_access_token();
      isConnected = !!accessToken;
    } catch {}

    if (!isConnected) {
      // Demo mode — simulate send
      return NextResponse.json({ demo: true, success: true });
    }

    // Build raw email in RFC 2822 format
    const rawEmail = [
      `To: ${to}`,
      `Subject: ${subject}`,
      "Content-Type: text/plain; charset=utf-8",
      "",
      body || "",
    ].join("\r\n");

    const encodedMessage = Buffer.from(rawEmail)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await corsair.gmail.api.messages.send({
      raw: encodedMessage,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Send Email Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
