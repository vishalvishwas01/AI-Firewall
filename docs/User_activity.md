Yes. This is absolutely possible, and for HallGuard it makes sense to keep **login activity** separate from your normal application data.

The important point is that you should collect the IP address **on the backend**, not from the frontend. The browser can lie about values it sends, while your backend can observe the connection IP.

### Recommended flow

```text
User
  ↓
HallGuard frontend
  ↓
POST /auth/login
  ↓
Express backend
  │
  ├── authenticate user
  │
  ├── obtain client IP
  │
  ├── optionally resolve IP → location
  │
  └── store login event
          ↓
      MongoDB
```

Your current architecture already has the backend handling authentication, JWTs and MongoDB, so this belongs there. 

### What you can store

For example:

```js
{
  userId: ObjectId("..."),

  event: "login",

  ipAddress: "103.xxx.xxx.xxx",

  location: {
    country: "India",
    countryCode: "IN",
    region: "Delhi",
    city: "New Delhi",
    timezone: "Asia/Kolkata"
  },

  userAgent: "...",

  device: {
    browser: "Chrome",
    os: "Windows"
  },

  success: true,

  createdAt: ISODate("2026-08-18T01:45:00Z")
}
```

Then your dashboard could show:

```text
Login Activity

18 Aug 2026, 01:45
Chrome · Windows
New Delhi, India
IP: 103.xxx.xxx.xxx

16 Aug 2026, 22:14
Safari · iPhone
Ghaziabad, India
IP: 103.xxx.xxx.xxx
```

## How IP → country works

You have two main approaches.

### Option 1: IP geolocation API

Your backend receives:

```text
103.x.x.x
```

and queries an IP-geolocation provider.

It can return things such as:

```text
country
country code
region
city
timezone
ASN
ISP/organization
latitude/longitude
```

You then store only the fields you actually need.

I would **not** store precise latitude/longitude for HallGuard login history unless you have a specific product/security requirement.

### Option 2: Local IP database

Instead of:

```text
Backend
 ↓
External IP API
```

you can maintain an IP geolocation database on your server:

```text
Backend
 ↓
Local IP database
 ↓
India / Delhi / ...
```

This is better for privacy and avoids making an external request for every login.

For an early-stage HallGuard deployment, an external geolocation service is simpler. At larger scale, a local database can become more attractive.

---

## One important issue with Render/reverse proxies

This is where you need to be careful.

If your architecture becomes:

```text
User
 ↓
Cloudflare / Reverse Proxy
 ↓
Render
 ↓
Express
```

your Express application may see the **proxy's IP** rather than the user's actual IP unless your proxy and Express configuration correctly handle forwarded IP headers.

For Express, you'll commonly configure the trusted proxy appropriately, for example:

```js
app.set("trust proxy", 1);
```

Then use:

```js
req.ip
```

But don't blindly trust arbitrary `X-Forwarded-For` headers from the public internet.

The trusted-proxy configuration needs to match your actual deployment topology.

---

## I would also separate login activity from `users`

Don't keep adding login records directly into:

```text
users
```

Instead:

```text
users
login_activity
organizations
synced_logs
improvement_events
...
```

For example:

```text
login_activity
----------------------------
_id
userId
event
ipAddress
country
countryCode
region
city
timezone
userAgent
success
failureReason
createdAt
```

Then index:

```text
{ userId: 1, createdAt: -1 }
```

and potentially:

```text
{ ipAddress: 1, createdAt: -1 }
```

if you need security investigation by IP.

### Also record failed logins

This is actually more useful from a security perspective.

For example:

```text
Successful login
Successful login
Failed login
Failed login
Failed login
```

You can then detect:

```text
5 failed attempts
from same IP
within 10 minutes
```

and trigger rate limiting or additional protection.

Your existing architecture already specifies authentication-specific rate limiting, so login activity can complement that rather than replace it. 

---

## One privacy consideration for HallGuard

Because you're positioning HallGuard as **privacy-first**, don't quietly collect a huge amount of location/device information.

I'd start with:

```text
IP address
Country
Country code
Region
City
Timezone
User agent
Success/failure
Timestamp
```

and define a retention period for login activity.

You should also make this part of your privacy documentation because an IP address is personal data in many privacy regimes, and geolocation derived from it is additional user information.

### My recommendation for HallGuard

Use:

```text
                 LOGIN
                   ↓
              Express API
                   ↓
        ┌──────────┴──────────┐
        ↓                     ↓
 Authentication          Login event
        │                     │
        ↓                     ↓
       JWT              IP geolocation
                              ↓
                         MongoDB
```

And keep **login activity completely separate from your AI detection logs**.

That separation is especially consistent with your current architecture, which already distinguishes authentication, redacted reporting, and bounded telemetry rather than treating all user data as one collection. 
