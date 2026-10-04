import http from "node:http";

function requestPromise(urlStr, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = http.request(
      url,
      {
        method: "GET",
        headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function formatCookieHeader(cookies) {
  if (Array.isArray(cookies)) {
    return cookies.map((c) => c.split(";")[0]).join("; ");
  }
  if (cookies) {
    return cookies.split(";")[0];
  }
  return "";
}

async function run() {
  const demoRes = await requestPromise("http://localhost:3000/api-auth/demo?next=/inbox");
  console.log("DEMO RES STATUS:", demoRes.status);
  const setCookies = demoRes.headers["set-cookie"];
  console.log("DEMO SET-COOKIES:", setCookies);

  const cookieHeader = formatCookieHeader(setCookies);
  console.log("FORWARDING COOKIE:", cookieHeader);

  const apiMeRes = await requestPromise("http://127.0.0.1:8000/trpc/auth.me?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D", {
    cookie: cookieHeader,
    "x-thread-csrf": "1",
  });
  console.log("API DIRECT /trpc/auth.me STATUS:", apiMeRes.status, "BODY:", apiMeRes.body);

  const webMeRes = await requestPromise("http://localhost:3000/trpc/auth.me?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%7D%7D", {
    cookie: cookieHeader,
    "x-thread-csrf": "1",
  });
  console.log("WEB PROXIED /trpc/auth.me STATUS:", webMeRes.status, "BODY:", webMeRes.body);
}

try {
  await run();
} catch (error) {
  console.error(error);
}
